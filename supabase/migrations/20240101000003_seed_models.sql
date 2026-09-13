-- Seed initial models
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) VALUES
-- Google Gemini
('gemini-1.5-pro', 'Gemini 1.5 Pro', 'kob', 'Google', TRUE, TRUE, 0.00000125, 0.000005, 10),
('gemini-1.5-flash', 'Gemini 1.5 Flash', 'kob', 'Google', TRUE, TRUE, 0.000000075, 0.0000003, 20),
('gemini-1.0-pro', 'Gemini 1.0 Pro', 'kob', 'Google', FALSE, TRUE, 0.0000005, 0.0000015, 30),

-- Anthropic Claude
('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'kob', 'Anthropic', TRUE, TRUE, 0.000003, 0.000015, 40),
('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 'kob', 'Anthropic', TRUE, TRUE, 0.000001, 0.000005, 50),
('claude-3-opus-20240229', 'Claude 3 Opus', 'kob', 'Anthropic', TRUE, TRUE, 0.000015, 0.000075, 60),

-- OpenAI GPT
('gpt-4o', 'GPT-4o', 'kob', 'OpenAI', TRUE, TRUE, 0.0000025, 0.00001, 70),
('gpt-4o-mini', 'GPT-4o Mini', 'kob', 'OpenAI', TRUE, TRUE, 0.00000015, 0.0000006, 80),
('gpt-4-turbo', 'GPT-4 Turbo', 'kob', 'OpenAI', TRUE, TRUE, 0.00001, 0.00003, 90),

-- DeepSeek
('deepseek-chat', 'DeepSeek V3', 'kob', 'DeepSeek', FALSE, TRUE, 0.00000027, 0.0000011, 100),
('deepseek-reasoner', 'DeepSeek R1', 'kob', 'DeepSeek', FALSE, TRUE, 0.00000055, 0.00000219, 110),

-- Qwen
('qwen-2.5-72b-instruct', 'Qwen 2.5 72B', 'kob', 'Alibaba', FALSE, TRUE, 0.0000004, 0.0000004, 120),
('qwen-2.5-vl-72b-instruct', 'Qwen 2.5 VL 72B', 'kob', 'Alibaba', TRUE, TRUE, 0.0000008, 0.0000008, 130),

-- Z.ai GLM
('glm-4', 'GLM-4', 'kob', 'Z.ai', FALSE, TRUE, 0.0000005, 0.0000005, 140),
('glm-4v', 'GLM-4V', 'kob', 'Z.ai', TRUE, TRUE, 0.000001, 0.000001, 150);