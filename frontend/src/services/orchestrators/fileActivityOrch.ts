import type { DayDetail, MonthData, SectionMonthData } from '../lego_blocks/typesBlock'
import { getVaultFS } from '../lego_blocks/fsBlock'
import {
  getMonthActivity as scanMonthActivity,
  getDayActivity as scanDayActivity,
  getSectionMonthActivity as scanSectionMonthActivity,
} from '../lego_blocks/fileActivityBlock'

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
