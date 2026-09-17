import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { ACCESSIBLE_ROUTES, routeDocumentTitle } from './navigation_accessibility'

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')
const router = read('./router.ts')
const screens = readdirSync(new URL('./screens/', import.meta.url)).filter(name => name.endsWith('.ts')).map(name => read(`./screens/${name}`)).join('\n')

function nestedAnchorCount(source: string): number {
  const file = ts.createSourceFile('screens.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let count = 0
  const isAnchor = (node: ts.Node): node is ts.CallExpression => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'h' && node.arguments[0]?.getText(file) === "'a'"
  const visit = (node: ts.Node): void => {
    if (isAnchor(node)) for (const argument of node.arguments.slice(1)) { const find = (child: ts.Node): void => { if (isAnchor(child)) count++; else child.forEachChild(find) }; argument.forEachChild(find) }
    node.forEachChild(visit)
  }
  visit(file)
  return count
}

describe('phase 7 completion static gate', () => {
  it('keeps the route registry and unique document titles exhaustive', () => {
    expect(ACCESSIBLE_ROUTES.length).toBeGreaterThanOrEqual(19)
    expect(new Set(ACCESSIBLE_ROUTES)).toHaveProperty('size', ACCESSIBLE_ROUTES.length)
    expect(new Set(ACCESSIBLE_ROUTES.map(routeDocumentTitle))).toHaveProperty('size', ACCESSIBLE_ROUTES.length)
    for (const route of ACCESSIBLE_ROUTES.filter(route => route !== 'home' && route !== 'book')) expect(router).toContain(`route.name === '${route}'`)
    expect(router).toContain("if (first === 'book' && second) return { name: 'reader', param: second }")
    expect(router).toContain("content = appFrame(homeScreen(), '#/')")
    expect(router).toContain('setSourceDocumentTitle(routeDocumentTitle(')
  })

  it('provides one application main and screen-level H1 contracts without nested anchor construction', () => {
    expect(read('./shell.ts').match(/h\('main'/g)).toHaveLength(1)
    for (const name of ['home', 'quran', 'browse', 'library', 'search', 'me', 'settings', 'notes', 'shelves', 'reading_plans', 'research_projects', 'editions', 'series', 'data_quality', 'welcome']) expect(read(`./screens/${name}.ts`)).toContain("h('h1'")
    expect(nestedAnchorCount(screens)).toBe(0)
  })

  it('defaults every generated button to a safe type and preserves explicit submits', () => {
    const ui = read('./ui.ts')
    expect(ui).toContain("if (tag === 'button') (el as HTMLButtonElement).type = 'button'")
    expect(screens).toContain("type: 'submit'")
  })

  it('hides button-driven file inputs through the shared accessibility helper', () => {
    const imports = read('./book_import.ts')
    expect(imports).not.toContain("style: 'display:none'")
    expect(imports.match(/makeProgrammaticFileInput\(/g)?.length).toBeGreaterThanOrEqual(2)
    expect(read('./programmatic_file_input.ts')).toContain("input.setAttribute('aria-hidden', 'true')")
  })

  it('retains query round-trip and narrow-layout overflow regression gates', () => {
    for (const test of ['hash_query_state.test.ts', 'uncategorized_filter.test.ts', 'notes_search_url_contract.test.ts', 'responsive_contract.test.ts']) expect(read(`./${test}`)).toBeTruthy()
    const css = `${read('./styles/screens.css')}\n${read('./styles/components.css')}`
    expect(css).toContain('overflow-x: clip')
    expect(css.match(/minmax\(0, 1fr\)/g)?.length).toBeGreaterThan(15)
    expect(css).toMatch(/@media \(max-width: (?:520|560|620)px\)/)
  })
})
