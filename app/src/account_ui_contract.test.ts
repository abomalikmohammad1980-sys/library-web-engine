import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const signIn = readFileSync(new URL('./screens/sign_in.ts', import.meta.url), 'utf8')
const admin = readFileSync(new URL('./screens/admin_books.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8')
const me = readFileSync(new URL('./screens/me.ts', import.meta.url), 'utf8')

describe('واجهة الحسابات الموثقة', () => {
  it('restores the server session at startup and offers explicit sign in and sign out', () => {
    expect(main).toContain('cloudflareAccessAuthProvider.currentSession()')
    expect(main).toContain("window.addEventListener('alkhizana:account-changed', () => render(false))")
    expect(main).not.toContain('currentSession().then(()=>render')
    expect(signIn).toContain("'تسجيل الدخول'")
    expect(signIn).toContain("'تسجيل الخروج'")
    expect(signIn).toContain('cloudflareAccessAuthProvider.signOut()')
    expect(signIn).toContain('loadAccountReadiness()')
    expect(signIn).toContain('currentSession().catch(error=>')
    expect(signIn).toContain('sessionCheckFailed=true;return null')
    expect(signIn).toContain('device_limit_reached|device_revoked|account_blocked')
    expect(signIn).toContain("title:'تسجيل الدخول غير مفعّل بعد'")
    expect(signIn).toContain('accountReadinessArabic(readiness)')
    expect(signIn).toContain("'لم نستطع فحص جاهزية تسجيل الدخول. يمكنك متابعة القراءة بصفة ضيف.'")
  })

  it('lets managers review submissions without granting published metadata editing', () => {
    expect(admin).toContain("hasAccountPermission(claims, 'book:review-submissions')")
    expect(admin).toContain("hasAccountPermission(claims, 'book:edit-published-metadata')")
    expect(admin).toMatch(/if\(canReview\)\{\s*root\.append\(reviewWorkspace,stats\)/)
    expect(admin).toContain('if (canReview) { root.append(submissions)')
    expect(admin).toContain('if (canEditPublished) root.append(adminPublishedLibrary())')
    expect(admin).toContain("if(claims?.role==='super-admin')root.append(adminAudiencePanel(),oversightPanel(changed))")
    expect(admin).not.toContain('listBooks()')
    expect(me).toContain("hasAccountPermission(currentAccountClaims(), 'book:review-submissions')")
    expect(me).toContain("'مراجعة إضافات المستخدمين'")
    expect(admin).toContain('loadAccountAdminStats()')
    expect(admin).toContain("item('الحسابات المسجلة',stats.accountsTotal)")
    expect(admin).toContain("item('كتب مقبولة',stats.approved)")
    expect(admin).toContain("item('كتب مرفوضة',stats.rejected)")
    expect(admin).toContain("['approved','المقبولة']")
    expect(admin).toContain("['rejected','المرفوضة']")
    expect(admin).toContain("['all','كل الحالات']")
  })

  it('shows authenticated identity instead of labelling every account as a guest session', () => {
    expect(me).toContain('const name = claims.displayName?.trim()')
    expect(me).toContain("if (claims) {")
    expect(me).toContain("} else identityNode.replaceChildren(icon('person', 16), 'حياكم الله حضرة الضيف")
    expect(me).toContain("claims ? 'قراءاتي وكتبي وإنجازي اليومي محفوظة ضمن هذا الحساب'")
  })
})
