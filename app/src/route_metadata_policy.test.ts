import {expect,it} from 'vitest'
import {routeNeedsMetadataBeforeRender} from './route_metadata_policy'
it('does not gate reading or static landing content on optional database metadata',()=>{
 for(const name of ['home','features','welcome','quran','quran-tafsir','reader','not-found'])expect(routeNeedsMetadataBeforeRender(name)).toBe(false)
})
it('preserves current metadata before filters, directories and editing',()=>{
 for(const name of ['library','authors','author','categories','search','admin-books','sunnah','unknown'])expect(routeNeedsMetadataBeforeRender(name)).toBe(true)
})
