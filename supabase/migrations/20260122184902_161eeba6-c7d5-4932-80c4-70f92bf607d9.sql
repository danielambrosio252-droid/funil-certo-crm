-- Apagar dados e tabelas de Fluxos
-- Primeiro deletar na ordem correta por FK

-- Remover dados
DELETE FROM whatsapp_flow_executions;
DELETE FROM whatsapp_flow_edges;
DELETE FROM whatsapp_flow_nodes;
DELETE FROM whatsapp_flows;

-- Dropar tabelas (ordem reversa de dependências)
DROP TABLE IF EXISTS whatsapp_flow_executions CASCADE;
DROP TABLE IF EXISTS whatsapp_flow_edges CASCADE;
DROP TABLE IF EXISTS whatsapp_flow_nodes CASCADE;
DROP TABLE IF EXISTS whatsapp_flows CASCADE;