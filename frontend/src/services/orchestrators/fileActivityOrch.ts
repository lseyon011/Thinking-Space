import type { DayDetail, MonthData, SectionMonthData } from '@/services/lego_blocks/units/typesBlock'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  getMonthActivity as scanMonthActivity,
  getDayActivity as scanDayActivity,
  getSectionMonthActivity as scanSectionMonthActivity,
} from '@/services/lego_blocks/integrations/fileActivityBlock'

export async function getMonthActivity(year: number, month: number): Promise<MonthData> {
  const fs = getVaultFS()
  return scanMonthActivity(fs, year, month)
}

export async function getDayActivity(date: string): Promise<DayDetail> {
  const fs = getVaultFS()
  return scanDayActivity(fs, date)
}

export async function getSectionMonthActivity(
  year: number,
  month: number,
  section: string,
): Promise<SectionMonthData> {
  const fs = getVaultFS()
  return scanSectionMonthActivity(fs, year, month, section)
}
