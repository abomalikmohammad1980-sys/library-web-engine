import {it,expect} from 'vitest'
import {searchScopeCountIdentity} from './screens/search'
it('compares semantic filters while ignoring pagination and set ordering',()=>{
 const a={bookIds:['b','a'],authors:['مؤلف'],contentScope:'foot' as const,fields:['body'] as ['body'],deathFrom:100}
 expect(searchScopeCountIdentity(a)).toBe(searchScopeCountIdentity({...a,bookIds:['a','b','b'],resultOffset:40,resultLimit:40}))
 for(const change of [{bookIds:['a']},{authors:[]},{categories:['فقه']},{deathFrom:101},{deathTo:200},{deathState:'contemporary' as const},{contentScope:'body' as const},{fields:['heading'] as ['heading']}])expect(searchScopeCountIdentity({...a,...change})).not.toBe(searchScopeCountIdentity(a))
})
