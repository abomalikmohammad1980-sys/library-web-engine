import { describe,expect,it } from "vitest";import { createServiceInstallPlan,guardServicePlatform,renderLaunchdPlist,renderSystemdUserUnit,renderWindowsTaskContract } from "./service-descriptors.js";
const win={name:"khizana.sync",executablePath:"C:\\Program Files\\Khizana\\sync.exe",configPath:"C:\\Users\\A&B\\sync config.json",stdoutPath:"C:\\Logs\\sync out.log",stderrPath:"C:\\Logs\\sync err.log",restartSeconds:10};
const posix={name:"khizana.sync",executablePath:"/opt/Khizana Sync/bin/sync",configPath:"/home/a&b/sync config.json",stdoutPath:"/home/a/logs/out.log",stderrPath:"/home/a/logs/err.log",restartSeconds:10};
describe("service descriptors",()=>{it("renders escaped descriptors with absolute paths and no secret values",()=>{const w=renderWindowsTaskContract(win),m=renderLaunchdPlist(posix),l=renderSystemdUserUnit(posix);expect(w).toContain("A&amp;B");expect(m).toContain("a&amp;b");expect(l).toContain('ExecStart="/opt/Khizana Sync/bin/sync" run --config "/home/a&b/sync config.json"');for(const x of [w,m,l])expect(x).not.toContain("super-secret-value")});it("returns dry install/uninstall plans requiring caller confirmation",()=>{const install=createServiceInstallPlan("linux","install",posix),remove=createServiceInstallPlan("linux","uninstall",posix);expect(install).toMatchObject({requiresExplicitConfirmation:true,operation:"install"});expect(install.descriptor).toMatchSnapshot();expect(remove.descriptor).toBeUndefined()});it("rejects relative paths and cross-platform execution",()=>{expect(()=>renderSystemdUserUnit({...posix,configPath:"relative.json"})).toThrow(/absolute/);expect(()=>guardServicePlatform("darwin","linux")).toThrow(/mismatch/)})});


describe("target-platform path validation", () => {
  for (const field of ["executablePath", "configPath", "stdoutPath", "stderrPath"] as const) {
    it(`rejects relative ${field} for every target`, () => {
      expect(() => renderWindowsTaskContract({ ...win, [field]: "relative/file" })).toThrow(/absolute/);
      expect(() => renderLaunchdPlist({ ...posix, [field]: "relative/file" })).toThrow(/absolute/);
      expect(() => renderSystemdUserUnit({ ...posix, [field]: "relative/file" })).toThrow(/absolute/);
      expect(() => createServiceInstallPlan("win32", "uninstall", { ...win, [field]: "relative/file" })).toThrow(/absolute/);
    });
  }
  it("rejects Windows paths for POSIX descriptors regardless of the host", () => {
    expect(() => renderLaunchdPlist(win)).toThrow(/absolute/);
    expect(() => renderSystemdUserUnit(win)).toThrow(/absolute/);
    expect(() => createServiceInstallPlan("linux", "uninstall", win)).toThrow(/absolute/);
  });
});
