CREATE TABLE report_settings (id INTEGER PRIMARY KEY CHECK(id=1), period TEXT NOT NULL CHECK(period IN ('week','month')));
INSERT INTO report_settings VALUES(1,'week');
