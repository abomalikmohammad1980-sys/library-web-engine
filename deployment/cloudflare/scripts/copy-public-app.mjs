import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stageTarajmBiographyBundle, stageTarajmPersonAssets } from "./tarajm-biography-stage.mjs";
import {stageOptionalHeadingRelease} from "./heading-release-stage.mjs";
import {stageShamelaBiographies} from "./shamela-biography-stage.mjs";
import {stageAuthorPersonRelease} from "./author-person-release-stage.mjs";
import {stageSearchCatalog} from "./search-catalog.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const source = process.env.KHIZANA_APP_DIST
  ? resolve(process.env.KHIZANA_APP_DIST)
  : resolve(here, "../../app/dist");
const appPublic = resolve(here, "../../app/public");
const destinations = [resolve(here, "../public/khizana")];
const excluded = new Set(["books", "data"]);
const publicCatalogs = [
  "home-library-statistics.json",
  "author-supplement.json",
  "shamela-author-index.json",
  "shamela-author-metadata.json",
  "shamela-catalog.snapshot.json",
  "author-biography-coverage.manifest.json",
  "author-biography-review.manifest.json",
  "shamela-authors.json",
  "shamela-gateways.json",
  "tarajm-author-map.json",
  "people-facets.json",
];
const publishedLibraryEntries = new Set(["published", "shamela-sample"]);

async function copyPublishedLibrary(destination) {
  const librarySource = resolve(source, "library");
  const libraryDestination = resolve(destination, "library");
  await mkdir(libraryDestination, { recursive: true });
  let entries = [];
  try {
    entries = await readdir(librarySource, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  for (const entry of entries) {
    if (!publishedLibraryEntries.has(entry.name)) continue;
    await cp(resolve(librarySource, entry.name), resolve(libraryDestination, entry.name), {
      recursive: entry.isDirectory(),
      force: true,
    });
  }
  // Vite deliberately omits the reviewed publication tree because its binary
  // assets live in R2. The small manifest is nevertheless a runtime control
  // file: the browser needs it to discover approved works, while requests for
  // its source paths are served by functions/library/[[path]].js from R2.
  // Copy only that authoritative manifest; never mirror the multi-GB assets.
  const stagedManifest = resolve(libraryDestination, "published/manifest.json");
  try {
    await access(stagedManifest);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const reviewedManifest = resolve(appPublic, "library/published/manifest.json");
    await mkdir(resolve(libraryDestination, "published"), { recursive: true });
    await cp(reviewedManifest, stagedManifest, { force: true });
  }
}

async function copyCleanBundle(destination) {
  // Windows scanners may briefly retain newly generated metadata files. Retry
  // boundedly so a transient EPERM cannot leave a half-old release directory.
  if (process.env.KHIZANA_INCREMENTAL_STAGE !== "1") {
    await rm(destination, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
  await mkdir(destination, { recursive: true });
  let libraryCopied = false;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    console.log(`copy release entry: ${entry.name}`);
    if (entry.name === "library") {
      await copyPublishedLibrary(destination);
      libraryCopied = true;
      continue;
    }
    await cp(resolve(source, entry.name), resolve(destination, entry.name), {
      recursive: entry.isDirectory(),
      force: true,
    });
  }
  // The optimized Vite output normally has no library directory at all.
  // Materialize its reviewed control manifest explicitly in that case.
  if (!libraryCopied) await copyPublishedLibrary(destination);
  // The production library is streamed from the private R2 binding. Keep the
  // route root present without copying multi-GB book artifacts into Pages.
  await mkdir(resolve(destination, "library"), { recursive: true });
  // مرشح Vite هو الحد المراجع للنشر. لا تخلطه مجددًا مع app/public؛ فقد
  // يحتوي الأخير corpus وفهارس محلية كبيرة ليست ضمن إصدار Pages.
  // هذه كتالوجات عامة للمؤلفين وليست كتب المستخدم أو بياناته المحلية.
  await mkdir(resolve(destination, "data"), { recursive: true });
  for (const name of publicCatalogs) {
    await cp(resolve(source, "data", name), resolve(destination, "data", name), { force: true });
  }
  // Vite may expose only the reviewed single 25 MiB source. Convert it here,
  // at the final Pages boundary, instead of silently publishing no biography
  // files or copying the oversized source/corpus tree.
  const tarajmStage = await stageTarajmBiographyBundle(resolve(source, "data"), resolve(destination, "data"));
  const personStage = await stageTarajmPersonAssets(resolve(source, "data"), resolve(destination, "data"));
  const headingStage = await stageOptionalHeadingRelease(source,destination);
  const biographyStage = await stageShamelaBiographies(source,destination);
  const authorPersonStage = await stageAuthorPersonRelease(source,destination);
  // These generation-addressed assets are part of the reviewed build, not
  // optional development data. Omitting them breaks the new heading provider.
  const headingDirectories=['heading-dictionary','heading-catalog-supplement'];
  for(const name of headingDirectories)await cp(resolve(source,'data',name),resolve(destination,'data',name),{recursive:true,force:true});
  const stagedPublicCatalogs = [...publicCatalogs, ...tarajmStage.files, ...personStage.files, ...headingStage.files, ...biographyStage.files, ...authorPersonStage.files,...headingDirectories];
  const packedSearchConfig = `globalThis.__SHAMELA_SEARCH_V2_PACKED__=Object.freeze({controlBaseUrl:location.origin+"/r2/khezana-search-v2-00/control",projectBaseUrls:Array.from({length:8},(_,index)=>location.origin+"/r2/khezana-search-v2-"+String(index).padStart(2,"0"))});\n`;
  await writeFile(resolve(destination, "data/shamela-search-v2-packed.js"), packedSearchConfig, "utf8");
  const indexPath = resolve(destination, "index.html");
  const index = await readFile(indexPath, "utf8");
  const script = '    <script src="./data/shamela-search-v2-packed.js"></script>\n';
  if (!index.includes("data/shamela-search-v2-packed.js")) {
    const needle = '    <script type="module"';
    if (!index.includes(needle)) throw new Error("public_app_index_anchor_missing");
    await writeFile(indexPath, index.replace(needle, script + needle), "utf8");
  }
  // Keep the Mushaf pages at their runtime URLs. The reader fetches individual
  // `.svg` files directly, so replacing them with `.svg.gz` assets makes the
  // SPA fallback return HTML and breaks the Quran screen in production.
  const names = new Set(await readdir(destination));
  const dataNames = new Set(await readdir(resolve(destination, "data")));
  const libraryNames = new Set(await readdir(resolve(destination, "library")));
  if (names.has("books") || libraryNames.has("shamela") || libraryNames.has("shamela-search") || [...libraryNames].some(name => !publishedLibraryEntries.has(name)) || dataNames.size !== stagedPublicCatalogs.length + 1 || stagedPublicCatalogs.some((name) => !dataNames.has(name)) || !dataNames.has("shamela-search-v2-packed.js") || !names.has("index.html") || !names.has("assets")) {
    throw new Error("public_app_bundle_validation_failed");
  }
}

let sourceAvailable = true;
try {
  await access(source);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  sourceAvailable = false;
}

if (sourceAvailable) {
  // Validate current sources, pinned descriptor and candidate bytes before any
  // destination cleanup. Never regenerate a snapshot while staging a build.
  const {checkCatalogSnapshot} = await import("../../tools/build-shamela-catalog-snapshot.mjs");
  await checkCatalogSnapshot(resolve(here, "../.."), source);
  const {verifySourceEditionRelease} = await import("../../tools/verify-source-edition-release.mjs");
  await verifySourceEditionRelease(source);
  for (const destination of destinations) {
    await copyCleanBundle(destination);
    // The existing Pages release is near its file limit. Keep this explicit
    // until the catalog delivery capacity and live routes have been validated.
    if (process.env.KHIZANA_STAGE_SEARCH_CATALOG === '1') {
      console.log('Search catalog:', await stageSearchCatalog(destination));
    }
  }
} else {
  // Sites يبني هذا المشروع من مستودعه المنفصل؛ الحزمة المراجعة مثبتة مسبقًا
  // في public/khizana ولا يوجد مجلد app شقيق داخل بيئة البناء.
  for (const destination of destinations) {
    const names = new Set(await readdir(destination));
    if (!names.has("index.html") || !names.has("assets") || !names.has("library")) throw new Error("public_app_bundle_missing");
  }
}
