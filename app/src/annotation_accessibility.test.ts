import { describe, expect, it } from 'vitest'
import { annotationActionLabel, annotationDeletePrompt, annotationTitleId } from './annotation_accessibility'

describe('annotation card accessibility', () => {
  it('creates stable unique title ids and contextual actions', () => {
    expect(annotationTitleId('note-1')).toBe(annotationTitleId('note-1'))
    expect(annotationTitleId('note-1')).not.toBe(annotationTitleId('note-2'))
    expect(annotationActionLabel('delete', 'ملاحظة', 'كتاب العلم', 5)).toBe('حذف ملاحظة من كتاب العلم، صفحة 5')
    expect(annotationActionLabel('download', 'تظليل', 'كتاب العلم', 2)).toContain('تنزيل بطاقة تظليل')
    expect(annotationActionLabel('copy', 'ملاحظة', 'كتاب العلم', 5)).toContain('نسخ موثّق ملاحظة')
    expect(annotationActionLabel('remembered', 'ملاحظة', 'كتاب العلم', 5)).toBe('تذكرت ملاحظة من كتاب العلم، صفحة 5')
    expect(annotationActionLabel('again', 'تظليل', 'كتاب العلم', 2)).toBe('مراجعة قريبة تظليل من كتاب العلم، صفحة 2')
    expect(annotationActionLabel('dueNow', 'تظليل', 'كتاب العلم', 2)).toBe('تقديم مراجعة اليوم تظليل من كتاب العلم، صفحة 2')
    expect(annotationDeletePrompt('ملاحظة', 5, 'كتاب العلم')).toContain('لا يمكن التراجع')
  })
})
