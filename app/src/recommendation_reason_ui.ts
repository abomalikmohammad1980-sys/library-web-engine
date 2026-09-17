import {uiTemplateText} from './ui_template_binding'
import type {ReadingRecommendation} from './reading_recommendations'
export function recommendationReasonText(item:Pick<ReadingRecommendation,'reason'|'reasonBinding'>):Text|string{
 return item.reasonBinding?uiTemplateText(item.reasonBinding.id,item.reasonBinding.parameters):item.reason
}
