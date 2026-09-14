-- Seed default service maintenance setting
INSERT INTO public.app_settings (key, value)
VALUES (
  'service_maintenance',
  '{
    "enabled": false,
    "mode": "notice",
    "title": "ระบบกำลังปิดปรับปรุงชั่วคราว",
    "message": "ขออภัยในความไม่สะดวก ระบบกำลังดำเนินการบำรุงรักษาและอัปเกรดเพื่อเพิ่มประสิทธิภาพการใช้งาน",
    "estimated_end_time": "",
    "allow_admins": true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
