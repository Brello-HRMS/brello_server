export interface ResolvedVariables {
  values: Record<string, string>;
  missing: string[];
}

export interface SalaryComponentLine {
  component_name: string;
  amount: number | string;
}

export interface SalaryTableModel {
  components: SalaryComponentLine[];
  total: number | string;
}

export interface SignatoryModel {
  name: string;
  designation: string;
}

export interface WatermarkModel {
  /** Short diagonal stamp text, e.g. "ACCEPTED". */
  label: string;
  /** Footer note printed after the document body, e.g. who accepted it and when. */
  note: string;
}

export interface RenderModel {
  heading: string;
  paragraphs: string[];
  bulletList: string[];
  salaryTable: SalaryTableModel | null;
  signatory: SignatoryModel | null;
  /** Optional — when set, stamps the PDF with a diagonal watermark and a footer note. */
  watermark?: WatermarkModel;
}

export interface LetterSnapshots {
  heading_snapshot: string;
  paragraphs_snapshot: string[];
  bullets_snapshot: string[];
  salary_snapshot: SalaryTableModel | null;
  signatory_snapshot: SignatoryModel | null;
  variable_snapshot: Record<string, string>;
}
