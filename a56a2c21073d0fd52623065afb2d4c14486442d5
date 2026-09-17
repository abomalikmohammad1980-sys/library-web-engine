import { describe, expect, it, vi } from 'vitest'
import { bulkDeleteBooks, bulkSelectableIds, bulkShelfUpdate, reconcileBulkSelection } from './library_bulk'

describe('filtered library bulk operations', () => {
  it('keeps selection inside the latest filter scope', () => { const selected = new Set(['a', 'b', 'outside']); reconcileBulkSelection(selected, new Set(['a', 'b', 'c'])); expect([...selected].sort()).toEqual(['a', 'b']) })
  it('selects every visible editable result and excludes system-managed books', () => { expect([...bulkSelectableIds([{ id: 'a' }, { id: 'system', managedSource: 'published' }, { id: 'b' }])]).toEqual(['a', 'b']) })
  it('reports partial delete failures', async () => { const remove = vi.fn(async (id: string) => { if (id === 'b') throw new Error('blocked') }); await expect(bulkDeleteBooks(['a', 'b', 'c'], remove)).resolves.toEqual({ deleted: 2, failed: ['b'] }) })
  it('adds, removes, and moves without touching other books', () => { const shelves = [{ id: 'one', name: 'أ', bookIds: ['a', 'x'], createdAt: 1 }, { id: 'two', name: 'ب', bookIds: ['b'], createdAt: 2 }], selected = new Set(['a', 'b']); expect(bulkShelfUpdate(shelves, selected, 'two', 'move')).toEqual([{ ...shelves[0], bookIds: ['x'] }, { ...shelves[1], bookIds: ['a', 'b'] }]); expect(bulkShelfUpdate(shelves, selected, 'one', 'remove')[0]?.bookIds).toEqual(['x']) })
})
