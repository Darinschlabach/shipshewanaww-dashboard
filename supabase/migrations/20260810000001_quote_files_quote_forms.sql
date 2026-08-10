-- Allow quote Files "Quote Forms" category on quote_files.
ALTER TABLE quote_files
  DROP CONSTRAINT IF EXISTS quote_files_drawing_category_check;

ALTER TABLE quote_files
  ADD CONSTRAINT quote_files_drawing_category_check
  CHECK (
    drawing_category IN (
      'provided_drawings',
      'production_drawings',
      'quote_forms',
      'misc'
    )
  );
