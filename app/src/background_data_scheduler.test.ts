import {it,expect,vi} from 'vitest'
import {createBackgroundDataScheduler,backgroundDataRouteAllowed,waitForBackgroundDataInteraction} from './background_data_scheduler'
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve()}
function fixture(){let hash='#/',visible=true;const idle:Array<()=>void>=[],run=vi.fn(async()=>{}),scheduler=createBackgroundDataScheduler({canRun:()=>visible&&backgroundDataRouteAllowed(hash),idle:callback=>idle.push(callback),run});return {idle,run,scheduler,route:(next:string)=>{hash=next},hide:()=>{visible=false},show:()=>{visible=true}}}
it('defers protected screens and resumes home without starvation',async()=>{
 const f=fixture();f.route('#/me');f.scheduler.notify();expect(f.idle).toHaveLength(0);f.route('#/');f.scheduler.notify();expect(f.idle).toHaveLength(1);f.idle.shift()!();await tick();expect(f.run).toHaveBeenCalledOnce()
})
it('rechecks route and visibility inside the idle callback',async()=>{
 const f=fixture();f.scheduler.notify();f.route('#/reader/1');f.idle.shift()!();await tick();expect(f.run).not.toHaveBeenCalled();f.route('#/library');f.scheduler.notify();f.hide();f.idle.shift()!();await tick();expect(f.run).not.toHaveBeenCalled();f.show();f.scheduler.notify();f.idle.shift()!();await tick();expect(f.run).toHaveBeenCalledOnce()
})
it('schedules one idle job and one flight, then never repeats successful warmup',async()=>{
 const f=fixture();let release!:()=>void;f.run.mockImplementation(()=>new Promise<void>(resolve=>{release=resolve}));f.scheduler.notify();f.scheduler.notify();expect(f.idle).toHaveLength(1);f.idle.shift()!();await tick();f.scheduler.notify();expect(f.idle).toHaveLength(0);release();await tick();f.scheduler.notify();expect(f.run).toHaveBeenCalledOnce();expect(f.idle).toHaveLength(0)
})
it('permits only the home and library routes, never auth, authors, reading or search',()=>{
 for(const route of ['','#/','#/home','#/library','#/library?category=x'])expect(backgroundDataRouteAllowed(route)).toBe(true)
 for(const route of ['#/auth','#/sign-in','#/authors','#/author/2','#/me','#/search?q=x','#/quran','#/sunnah','#/reader/2'])expect(backgroundDataRouteAllowed(route)).toBe(false)
})
it('holds a network continuation until import closes, then resumes exactly once',async()=>{
 const events=new EventTarget(),render=vi.fn();let allowed=false
 const task=Promise.resolve('catalog').then(async result=>{if(await waitForBackgroundDataInteraction({events,canRun:()=>allowed}))render(result)})
 await tick();events.dispatchEvent(new Event('alkhizana:import-activity'));await tick();expect(render).not.toHaveBeenCalled()
 allowed=true;events.dispatchEvent(new Event('alkhizana:import-activity'));await task
 events.dispatchEvent(new Event('alkhizana:import-activity'));expect(render).toHaveBeenCalledExactlyOnceWith('catalog')
})
it('releases route waiters on navigation without rendering stale results or retaining listeners',async()=>{
 const events=new EventTarget(),remove=vi.spyOn(events,'removeEventListener'),controller=new AbortController()
 const waiting=waitForBackgroundDataInteraction({events,canRun:()=>false,signal:controller.signal})
 controller.abort();expect(await waiting).toBe(false);expect(remove).toHaveBeenCalledOnce()
 events.dispatchEvent(new Event('alkhizana:import-activity'));expect(remove).toHaveBeenCalledOnce()
})
it('continues immediately when no import is active, but respects an already aborted route',async()=>{
 const events=new EventTarget(),add=vi.spyOn(events,'addEventListener'),controller=new AbortController()
 expect(await waitForBackgroundDataInteraction({events,canRun:()=>true})).toBe(true)
 controller.abort();expect(await waitForBackgroundDataInteraction({events,canRun:()=>true,signal:controller.signal})).toBe(false)
 expect(add).not.toHaveBeenCalled()
})
