import SectionChecklistBlock from '@/components/lego_blocks/integrations/SectionChecklistBlock'
import { getThoughtsMonth, getThoughtsSectionMonth } from '@/services/orchestrators/thoughtsOrch'

export default function ThoughtsCalendarOrch() {
  return (
    <SectionChecklistBlock
      subjectTitle="Thoughts"
      subjectPluralLower="thoughts"
      fetchMonthData={getThoughtsMonth}
      fetchSectionMonthData={getThoughtsSectionMonth}
    />
  )
}
