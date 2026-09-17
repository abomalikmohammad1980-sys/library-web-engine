import * as annotations from './annotation_store'
import * as reviews from './spaced_review'
import * as projects from './research_project'
import {captureReadingIdentity} from './reading_identity_scope'

/** One synchronous identity boundary for annotations and their dependent records. */
export function captureAnnotationStores(){
  const identity=captureReadingIdentity()
  const bind=<A extends unknown[],R>(operation:(...args:A)=>R)=>(...args:A):R=>{
    if(!identity.isCurrent())throw new Error('تغيّر الحساب. أعد فتح هذه الشاشة قبل تعديل بيانات القراءة.')
    return operation(...args)
  }
  return {
    isCurrent:identity.isCurrent,
    getAnnotations:bind(annotations.getAnnotations),saveAnnotations:bind(annotations.saveAnnotations),
    addNote:bind(annotations.addNote),deleteNote:bind(annotations.deleteNote),
    addHighlight:bind(annotations.addHighlight),deleteHighlight:bind(annotations.deleteHighlight),toggleBookmark:bind(annotations.toggleBookmark),
    setHighlightComment:bind(annotations.setHighlightComment),
    listSpacedReviews:bind(reviews.listSpacedReviews),saveSpacedReviews:bind(reviews.saveSpacedReviews),recordReview:bind(reviews.recordReview),
    dueAnnotationIds:bind(reviews.dueAnnotationIds),nextReviewAt:bind(reviews.nextReviewAt),reviewTiming:bind(reviews.reviewTiming),makeReviewDueNow:bind(reviews.makeReviewDueNow),
    listResearchProjects:bind(projects.listResearchProjects),saveResearchProjects:bind(projects.saveResearchProjects),
    createResearchProject:bind(projects.createResearchProject),updateResearchProject:bind(projects.updateResearchProject),deleteResearchProject:bind(projects.deleteResearchProject),
  }
}
