INSERT INTO kpi_rules(code,label,points) VALUES ('new_contact','新增聯絡人',1) ON CONFLICT DO NOTHING;
UPDATE score_entries SET code='new_contact',label='新增聯絡人' WHERE id LIKE 'contact-created:%' AND code='contact';
