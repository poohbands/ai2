-- Vector similarity RPC for RAG
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  p_kb_id UUID,
  p_user_id UUID,
  p_embedding TEXT,
  p_top_k INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.content,
    1 - (c.embedding <=> p_embedding::vector) AS similarity
  FROM public.kb_chunks c
  WHERE c.kb_id = p_kb_id AND c.user_id = p_user_id AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_embedding::vector
  LIMIT p_top_k;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_memories(
  p_user_id UUID,
  p_embedding TEXT,
  p_top_k INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.content,
    1 - (m.embedding <=> p_embedding::vector) AS similarity
  FROM public.memories m
  WHERE m.user_id = p_user_id AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_embedding::vector
  LIMIT p_top_k;
END;
$$;
