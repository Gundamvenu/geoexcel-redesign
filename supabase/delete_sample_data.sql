-- DESTRUCTIVE. NOT part of the migrations and never run automatically.
-- Run it yourself (SQL editor) when you replace the SAMPLE catalogue with verified data.
-- Quotation items that referenced these products keep their text (product_name snapshot); their product_id becomes null.

delete from public.products where is_sample = true;
