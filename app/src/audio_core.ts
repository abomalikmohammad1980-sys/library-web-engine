/** نواة صوت عامة للتلاوات والكتب الصوتية والمحاضرات، بلا تنزيل أو تشغيل ذاتي. */
export type AudioWorkKind = 'quran-recitation' | 'audiobook' | 'lecture'
export interface AudioSource { sourceId: string; url?: string; licenseId: string; attribution: string; checksumSha256: string; byteSize: number; version: string }
export interface AudioSegment { segmentId: string; title?: string; startMs: number; endMs: number; transcript?: string; referenceId?: string }
export interface AudioChapter { chapterId: string; title: string; trackIds: readonly string[] }
export interface AudioTrack { trackId: string; workId: string; title: string; source: AudioSource; durationMs: number; segments: readonly AudioSegment[] }
export interface AudioWork { workId: string; kind: AudioWorkKind; title: string; authorOrReciter: string; chapters: readonly AudioChapter[]; tracks: readonly AudioTrack[] }
export interface AudioProgress { workId: string; trackId: string; positionMs: number; playbackSpeed: number; updatedAt: string }
export interface AudioBookmark { bookmarkId: string; workId: string; trackId: string; positionMs: number; label?: string; createdAt: string }
export interface AudioCachePolicy { maxBytes: number; downloadable: boolean; resumable: boolean; eviction: 'lru' }
export const DEFAULT_AUDIO_CACHE_POLICY: AudioCachePolicy = Object.freeze({ maxBytes: 512 * 1024 * 1024, downloadable: false, resumable: true, eviction: 'lru' })
export function validateAudioSource(source: AudioSource): boolean { return /^[a-f0-9]{64}$/i.test(source.checksumSha256) && source.byteSize > 0 && Boolean(source.sourceId && source.licenseId && source.attribution && source.version) }
export function validateAudioTrack(track: AudioTrack): boolean { return track.durationMs > 0 && validateAudioSource(track.source) && track.segments.every(segment => segment.startMs >= 0 && segment.endMs > segment.startMs && segment.endMs <= track.durationMs) }
export function clampPlaybackSpeed(speed: number): number { return Math.min(3, Math.max(.5, Math.round(speed * 4) / 4)) }

