import ExcelJS from 'exceljs';
import type { Response } from 'express';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export async function sendAsExcel(
  res: Response,
  filename: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('דוח');
  sheet.views = [{ rightToLeft: true }];
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  await workbook.xlsx.write(res);
  res.end();
}
