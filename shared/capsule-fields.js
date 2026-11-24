export const textFields = {
  project_name: { label: 'Project name', maxLength: 120, required: true },
  prompt_title: { label: 'Prompt title', maxLength: 160, required: true },
  prompt_version: { label: 'Prompt version', maxLength: 32 },
  category: { label: 'Category', maxLength: 60 },
  prompt_text: { label: 'Prompt text', maxLength: 12000, required: true },
  response_summary: { label: 'Response summary', maxLength: 4000 },
  usefulness: { label: 'Usefulness', maxLength: 60 },
  screenshot_url: { label: 'Screenshot link', maxLength: 2048 },
  notes: { label: 'Notes', maxLength: 4000 },
};

export const booleanFields = { reviewed: 'Reviewed', improved: 'Improved' };
