/** Keeps the reader's tafsir choice stable and rejects superseded async loads. */
export class QuranTafsirSession {
  private revision = 0

  constructor(public selectedIndex: number) {}

  select(index: number): void {
    this.selectedIndex = index
    this.revision += 1
  }

  begin(index = this.selectedIndex): number {
    this.selectedIndex = index
    this.revision += 1
    return this.revision
  }

  isCurrent(revision: number, index = this.selectedIndex): boolean {
    return revision === this.revision && index === this.selectedIndex
  }
}
