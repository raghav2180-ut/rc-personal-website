/**
 * The four states of a Top 3 task and the order a click moves through them:
 * empty → Done → Partly done → Not done → empty.
 * Stored in the Top3 tab's "Done" column as "", "Yes", "Partial", "No".
 */
export type Top3Status = '' | 'Yes' | 'Partial' | 'No';

export const TOP3_NEXT: Record<Top3Status, Top3Status> = { '': 'Yes', Yes: 'Partial', Partial: 'No', No: '' };

export const TOP3_LABEL: Record<Top3Status, string> = { '': 'Not marked', Yes: 'Done', Partial: 'Partly done', No: 'Not done' };

export const isTop3Status = (v: unknown): v is Top3Status => v === '' || v === 'Yes' || v === 'Partial' || v === 'No';

/** Save-message key for each new state. */
export const TOP3_SAVED: Record<Top3Status, string> = { '': 'task-cleared', Yes: 'task-done', Partial: 'task-partial', No: 'task-notdone' };
