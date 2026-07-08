const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORTA = process.env.PORTA || 3000;

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'R3d3M@e_JWT_Sup3rS3cr3t_2026';
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'rede_mae',
    user: process.env.DB_USER || 'redemae',
    password: process.env.DB_PASS || 'Red3M@e_S3cur3_2026!',
    max: 20
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Funções auxiliares
function gerarToken(usuario) {
    return jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: '7d' });
}

function verificarToken(req, res, next) {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: 'Token não fornecido.' });
    try {
        req.usuario = jwt.verify(header.split(' ')[1], JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

// ==================== ROTAS DE AUTENTICAÇÃO ====================

app.post('/api/auth/cadastro', async (req, res) => {
    try {
        const { nome, email, senha, telefone, cpf_cnpj, cidade, estado, termos } = req.body;
        if (!nome || !email || !senha || !telefone || !cpf_cnpj || !cidade || !estado) {
            return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
        }
        
        const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1 OR cpf_cnpj = $2', [email, cpf_cnpj]);
        if (existe.rows.length > 0) return res.status(409).json({ error: 'Email ou CPF já cadastrado.' });

        const senha_hash = await bcrypt.hash(senha, 12);
        const result = await pool.query(`
            INSERT INTO usuarios (nome, email, telefone, cpf_cnpj, senha_hash, endereco_cidade, endereco_estado, termos_aceitos)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, nome, email, telefone, data_cadastro
        `, [nome, email, telefone, cpf_cnpj, senha_hash, cidade, estado, !!termos]);

        const usuario = result.rows[0];
        const token = gerarToken(usuario);

        // Gerar eSIM automático
        const esim = await gerarESIM(usuario.id);

        res.status(201).json({
            mensagem: 'Cadastro realizado com sucesso!',
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, telefone: usuario.telefone },
            esim,
            token
        });
    } catch (err) {
        console.error('Erro cadastro:', err);
        res.status(500).json({ error: 'Erro interno ao processar cadastro.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const result = await pool.query('SELECT id, nome, email, telefone, cpf_cnpj, senha_hash, status FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas.' });

        const usuario = result.rows[0];
        if (usuario.status === 'bloqueado') return res.status(403).json({ error: 'Conta bloqueada.' });
        if (!await bcrypt.compare(senha, usuario.senha_hash)) return res.status(401).json({ error: 'Credenciais inválidas.' });

        const token = gerarToken(usuario);
        await pool.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [usuario.id]);

        res.json({
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, telefone: usuario.telefone },
            token
        });
    } catch (err) {
        console.error('Erro login:', err);
        res.status(500).json({ error: 'Erro interno ao processar login.' });
    }
});

async function gerarESIM(usuarioId) {
    const iccid = '8955' + crypto.randomInt(1000000000, 9999999999).toString().padStart(10, '0') + crypto.randomInt(0, 9);
    const imsi = '72405' + crypto.randomInt(1000000000, 9999999999).toString().padStart(10, '0');
    const ki = crypto.randomBytes(16).toString('hex').toUpperCase();
    const opc = crypto.randomBytes(16).toString('hex').toUpperCase();
    const ddds = ['11','21','31','41','51','61','71','81','91','85','47','48','49'];
    const msisdn = '55' + ddds[crypto.randomInt(0, ddds.length)] + '9' + crypto.randomInt(10000000, 99999999);

    await pool.query(`
        INSERT INTO sim_cards (iccid, imsi, ki, opc, usuario_id, msisdn, status, tipo, apn_configurada)
        VALUES ($1, $2, $3, $4, $5, $6, 'ativo', 'esim', 'redemae.internet')
    `, [iccid, imsi, ki, opc, usuarioId, msisdn]);

    return {
        ativado: true,
        esim: { iccid, imsi, msisdn, ki, opc, apn: 'redemae.internet' }
    };
}

// ==================== ROTAS DE USUÁRIO ====================

app.get('/api/usuario/perfil', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.nome, u.email, u.telefone, u.cpf_cnpj, u.saldo, u.endereco_cidade, u.endereco_estado, u.status, u.data_cadastro,
                   COALESCE(json_agg(json_build_object('iccid', sc.iccid, 'msisdn', sc.msisdn, 'status', sc.status, 'dados_consumidos_gb', sc.dados_consumidos_gb, 'plano', (SELECT nome FROM planos WHERE id = sc.plano_id))) FILTER (WHERE sc.id IS NOT NULL), '[]') as sim_cards
            FROM usuarios u LEFT JOIN sim_cards sc ON sc.usuario_id = u.id WHERE u.id = $1 GROUP BY u.id
        `, [req.usuario.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
});

app.get('/api/usuario/consumo', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COALESCE(SUM(dados_total_gb),0) as total_mes FROM historico_consumo hc
            JOIN sim_cards sc ON sc.id = hc.sim_card_id WHERE sc.usuario_id = $1
            AND hc.data_registro >= DATE_TRUNC('month', CURRENT_DATE)
        `, [req.usuario.id]);
        res.json({ consumo_gb: parseFloat(result.rows[0].total_mes), periodo: 'mensal' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar consumo.' });
    }
});

app.get('/api/usuario/dispositivos', verificarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM dispositivos WHERE usuario_id = $1 ORDER BY ultimo_contato DESC NULLS LAST', [req.usuario.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar dispositivos.' });
    }
});

app.post('/api/usuario/dispositivo/:id/roteador', verificarToken, async (req, res) => {
    try {
        const { ativar } = req.body;
        const result = await pool.query('UPDATE dispositivos SET modo_roteador = $1 WHERE id = $2 AND usuario_id = $3 RETURNING *', [ativar, req.params.id, req.usuario.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Dispositivo não encontrado.' });
        res.json({ sucesso: true, modo_roteador: ativar, mensagem: ativar ? 'Modo roteador ativado!' : 'Modo roteador desativado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao alternar modo roteador.' });
    }
});

// ==================== ROTAS DE PLANOS ====================

app.get('/api/planos', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, descricao, velocidade_mbps, franquia_gb, preco_mensal, tipo, permite_roteamento, max_conexoes_roteadas FROM planos WHERE ativo = true ORDER BY preco_mensal');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar planos.' });
    }
});

app.post('/api/planos/contratar', verificarToken, async (req, res) => {
    try {
        const { plano_id } = req.body;
        const plano = await pool.query('SELECT * FROM planos WHERE id = $1 AND ativo = true', [plano_id]);
        if (plano.rows.length === 0) return res.status(404).json({ error: 'Plano não encontrado.' });

        const usuario = await pool.query('SELECT saldo FROM usuarios WHERE id = $1', [req.usuario.id]);
        if (parseFloat(usuario.rows[0].saldo) < parseFloat(plano.rows[0].preco_mensal)) {
            return res.status(402).json({ error: 'Saldo insuficiente.', necessario: plano.rows[0].preco_mensal, saldo: usuario.rows[0].saldo });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE usuarios SET saldo = saldo - $1 WHERE id = $2', [plano.rows[0].preco_mensal, req.usuario.id]);
            await client.query("INSERT INTO transacoes (usuario_id, tipo, valor, saldo_anterior, saldo_posterior, status, descricao) VALUES ($1, 'assinatura', $2, $3, $4, 'confirmada', $5)",
                [req.usuario.id, plano.rows[0].preco_mensal, usuario.rows[0].saldo, parseFloat(usuario.rows[0].saldo) - parseFloat(plano.rows[0].preco_mensal), `Plano ${plano.rows[0].nome}`]);
            await client.query('UPDATE sim_cards SET plano_id = $1 WHERE usuario_id = $2 AND status = \'ativo\' LIMIT 1', [plano_id, req.usuario.id]);
            await client.query('COMMIT');
            res.json({ sucesso: true, mensagem: `Plano ${plano.rows[0].nome} contratado!` });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao contratar plano.' });
    }
});

// ==================== RECARGAS ====================

app.post('/api/usuario/recarga', verificarToken, async (req, res) => {
    try {
        const { valor } = req.body;
        if (!valor || valor < 10) return res.status(400).json({ error: 'Valor mínimo: R$ 10,00' });
        if (valor > 5000) return res.status(400).json({ error: 'Valor máximo: R$ 5.000,00' });

        const usuario = await pool.query('SELECT saldo FROM usuarios WHERE id = $1', [req.usuario.id]);
        const transacaoId = crypto.randomUUID();
        const codigoPix = `00020126580014BR.GOV.BCB.PIX0136${transacaoId}520400005303986540${valor.toFixed(2).replace('.', '')}5802BR5925REDE MAE TELECOM SA6009SAO PAULO62070503***6304`;

        await pool.query("INSERT INTO transacoes (usuario_id, tipo, valor, saldo_anterior, saldo_posterior, metodo_pagamento, transacao_id_externo, status, descricao) VALUES ($1, 'recarga', $2, $3, $4, 'pix', $5, 'pendente', $6)",
            [req.usuario.id, valor, usuario.rows[0].saldo, parseFloat(usuario.rows[0].saldo) + valor, transacaoId, `Recarga R$ ${valor.toFixed(2)}`]);

        res.json({ transacao_id: transacaoId, valor, codigo_pix: codigoPix, qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(codigoPix)}` });
    } catch (err) {
        res.status(500).json({ error: 'Erro na recarga.' });
    }
});

app.post('/api/webhook/pix/confirmacao', async (req, res) => {
    try {
        const { transacao_id, status } = req.body;
        const transacao = await pool.query('SELECT * FROM transacoes WHERE transacao_id_externo = $1', [transacao_id]);
        if (transacao.rows.length === 0) return res.status(404).json({ error: 'Transação não encontrada.' });
        if (status === 'confirmada') {
            await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE id = $2', [transacao.rows[0].valor, transacao.rows[0].usuario_id]);
            await pool.query("UPDATE transacoes SET status = 'confirmada', data_confirmacao = NOW() WHERE transacao_id_externo = $1", [transacao_id]);
        }
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro no webhook.' });
    }
});

// ==================== ADMIN ====================

app.get('/api/admin/dashboard', verificarToken, async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT (SELECT COUNT(*) FROM usuarios WHERE status='ativo') as usuarios_ativos,
                   (SELECT COUNT(*) FROM sim_cards WHERE status='ativo') as sims_ativos,
                   (SELECT COUNT(*) FROM conexoes_ativas WHERE status='ativa') as conexoes_ativas,
                   (SELECT COUNT(*) FROM transacoes WHERE status='confirmada' AND data_criacao>=DATE_TRUNC('month',CURRENT_DATE)) as transacoes_mes,
                   (SELECT COALESCE(SUM(valor),0) FROM transacoes WHERE status='confirmada' AND data_criacao>=DATE_TRUNC('month',CURRENT_DATE)) as receita_mes,
                   (SELECT COALESCE(SUM(dados_total_gb),0) FROM historico_consumo WHERE data_registro>=DATE_TRUNC('month',CURRENT_DATE)) as dados_trafegados_mes
        `);
        res.json(stats.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao carregar dashboard.' });
    }
});

// ==================== HEALTH ====================

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'online', banco: 'conectado', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: 'degradado', erro: err.message });
    }
});

// Fallback: servir index.html para rotas não encontradas (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORTA, () => {
    console.log(`🚀 Rede Mãe rodando em http://localhost:${PORTA}`);
    console.log(`📡 API: http://localhost:${PORTA}/api`);
});
