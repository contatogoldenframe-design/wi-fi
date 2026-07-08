CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(120) NOT NULL,
    cpf_cnpj VARCHAR(18) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    endereco_cidade VARCHAR(100) NOT NULL,
    endereco_estado VARCHAR(2) NOT NULL,
    saldo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    data_cadastro TIMESTAMP NOT NULL DEFAULT NOW(),
    ultimo_login TIMESTAMP,
    termos_aceitos BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE planos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(80) NOT NULL,
    descricao TEXT,
    velocidade_mbps INT NOT NULL DEFAULT 100,
    franquia_gb INT NOT NULL DEFAULT 50,
    preco_mensal DECIMAL(10,2) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'controle',
    permite_roteamento BOOLEAN NOT NULL DEFAULT FALSE,
    max_conexoes_roteadas INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO planos (nome, descricao, velocidade_mbps, franquia_gb, preco_mensal, tipo, permite_roteamento, max_conexoes_roteadas) VALUES
('Básico', 'Internet individual para uso diário', 50, 20, 49.90, 'controle', FALSE, 0),
('Intermediário', 'Internet rápida com compartilhamento', 150, 60, 89.90, 'controle', TRUE, 3),
('Avançado', 'Alta velocidade para compartilhar', 300, 150, 149.90, 'controle', TRUE, 10),
('Power 800', 'Máxima potência 800Mbps com roteamento total', 800, 500, 299.90, 'pospago', TRUE, 20),
('Empresarial', 'Solução corporativa com suporte premium', 500, 1000, 599.90, 'pospago', TRUE, 50);

CREATE TABLE sim_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iccid VARCHAR(22) UNIQUE NOT NULL,
    imsi VARCHAR(15) UNIQUE NOT NULL,
    ki VARCHAR(64) NOT NULL,
    opc VARCHAR(64),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    plano_id UUID REFERENCES planos(id),
    msisdn VARCHAR(15) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'disponivel',
    tipo VARCHAR(10) NOT NULL DEFAULT 'esim',
    apn_configurada VARCHAR(50) NOT NULL DEFAULT 'redemae.internet',
    dados_consumidos_gb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ativado_em TIMESTAMP DEFAULT NOW(),
    expira_em TIMESTAMP DEFAULT (NOW() + INTERVAL '1 year')
);

CREATE TABLE dispositivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sim_card_id UUID REFERENCES sim_cards(id),
    nome_dispositivo VARCHAR(100),
    fabricante VARCHAR(100),
    modelo VARCHAR(100),
    imei VARCHAR(17),
    modo_roteador BOOLEAN NOT NULL DEFAULT FALSE,
    dispositivos_conectados INT NOT NULL DEFAULT 0,
    ultimo_contato TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo'
);

CREATE TABLE conexoes_ativas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    sim_card_id UUID NOT NULL REFERENCES sim_cards(id),
    ip_alocado VARCHAR(45) NOT NULL,
    apn VARCHAR(50) NOT NULL DEFAULT 'redemae.internet',
    inicio_conexao TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'ativa',
    dados_up_gb DECIMAL(12,4) NOT NULL DEFAULT 0,
    dados_down_gb DECIMAL(12,4) NOT NULL DEFAULT 0
);

CREATE TABLE transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(20) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    saldo_anterior DECIMAL(12,2) NOT NULL,
    saldo_posterior DECIMAL(12,2) NOT NULL,
    metodo_pagamento VARCHAR(30),
    transacao_id_externo VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    descricao TEXT,
    data_criacao TIMESTAMP NOT NULL DEFAULT NOW(),
    data_confirmacao TIMESTAMP
);

CREATE TABLE historico_consumo (
    id BIGSERIAL PRIMARY KEY,
    sim_card_id UUID NOT NULL REFERENCES sim_cards(id),
    data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    dados_up_gb DECIMAL(10,4) NOT NULL DEFAULT 0,
    dados_down_gb DECIMAL(10,4) NOT NULL DEFAULT 0,
    dados_total_gb DECIMAL(10,4) NOT NULL DEFAULT 0
);
