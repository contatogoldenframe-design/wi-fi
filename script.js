// ==================== API CLIENT ====================
const API_URL = '/api';

const api = {
    async request(path, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };

        const res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers
        });

        const data = await res.json();
        if (!res.ok) throw data;
        return data;
    },

    async cadastro(dados) {
        return this.request('/auth/cadastro', {
            method: 'POST',
            body: JSON.stringify({
                nome: dados.nome,
                email: dados.email,
                senha: dados.senha,
                telefone: dados.telefone,
                cpf_cnpj: dados.cpf,
                cidade: dados.cidade,
                estado: dados.estado,
                termos: dados.termos
            })
        });
    },

    async login(email, senha) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, senha })
        });
    },

    async getPerfil() {
        return this.request('/usuario/perfil');
    },

    async getConsumo() {
        return this.request('/usuario/consumo');
    },

    async getPlanos() {
        return this.request('/planos');
    },

    async contratarPlano(planoId, simCardId) {
        return this.request('/planos/contratar', {
            method: 'POST',
            body: JSON.stringify({ plano_id: planoId, sim_card_id: simCardId })
        });
    },

    async getDispositivos() {
        return this.request('/usuario/dispositivos');
    },

    async ativarRoteador(dispositivoId, ativar) {
        return this.request(`/usuario/dispositivo/${dispositivoId}/roteador`, {
            method: 'POST',
            body: JSON.stringify({ ativar })
        });
    },

    async fazerRecarga(valor) {
        return this.request('/usuario/recarga', {
            method: 'POST',
            body: JSON.stringify({ valor })
        });
    },

    async getAdminDashboard() {
        return this.request('/admin/dashboard');
    }
};

// ==================== RENDER FUNCTIONS ====================

function renderDashboard() {
    const container = document.getElementById('pageContent');
    container.innerHTML = `
        <div class="stats-grid" id="statsGrid">
            <div class="stat-card"><div class="label">Consumo do mês</div><div class="value" id="consumoMes">--</div><div class="sub" id="consumoSub">Carregando...</div></div>
            <div class="stat-card"><div class="label">Velocidade contratada</div><div class="value" id="velocidade">--</div><div class="sub">Mbps</div></div>
            <div class="stat-card"><div class="label">Saldo</div><div class="value" id="saldo">--</div><div class="sub">Disponível</div></div>
            <div class="stat-card"><div class="label">Dispositivos</div><div class="value" id="dispositivosCount">--</div><div class="sub">Conectados</div></div>
        </div>
        <div style="background:var(--gray-900);border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
            <h3 style="margin-bottom:16px;">Status do Servidor</h3>
            <div id="serverStatus">
                <div style="display:flex;align-items:center;gap:8px;color:var(--success);">
                    <span style="width:10px;height:10px;background:var(--success);border-radius:50%;display:inline-block;animation:pulse 2s infinite;"></span>
                    Servidor online — 800 Mbps de capacidade
                </div>
            </div>
        </div>
    `;
    carregarDashboardData();
}

async function carregarDashboardData() {
    try {
        const [perfil, consumo] = await Promise.all([
            api.getPerfil(),
            api.getConsumo()
        ]);
        document.getElementById('saldo').textContent = `R$ ${parseFloat(perfil.saldo || 0).toFixed(2)}`;
        document.getElementById('consumoMes').textContent = `${consumo.consumo_gb || 0} GB`;
        document.getElementById('consumoSub').textContent = `${consumo.porcentagem_utilizada || 0}% da franquia`;
        
        if (perfil.sim_cards && perfil.sim_cards[0]) {
            document.getElementById('velocidade').textContent = perfil.sim_cards[0].plano || '--';
        }
        
        const dispositivos = await api.getDispositivos();
        document.getElementById('dispositivosCount').textContent = dispositivos.length || 0;
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
}

function renderESIM() {
    const esim = JSON.parse(localStorage.getItem('esim') || '{}');
    const container = document.getElementById('pageContent');
    
    container.innerHTML = `
        <div style="background:var(--gray-900);border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);max-width:600px;">
            <h3 style="margin-bottom:24px;">Meu eSIM</h3>
            <div style="background:var(--dark);border-radius:12px;padding:24px;margin-bottom:20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div><div style="font-size:12px;color:var(--gray-400);margin-bottom:4px;">ICCID</div><div style="font-family:monospace;font-size:14px;">${esim.esim?.iccid || '--'}</div></div>
                    <div><div style="font-size:12px;color:var(--gray-400);margin-bottom:4px;">IMSI</div><div style="font-family:monospace;font-size:14px;">${esim.esim?.imsi || '--'}</div></div>
                    <div><div style="font-size:12px;color:var(--gray-400);margin-bottom:4px;">MSISDN (Número)</div><div style="font-family:monospace;font-size:14px;">${esim.esim?.msisdn || '--'}</div></div>
                    <div><div style="font-size:12px;color:var(--gray-400);margin-bottom:4px;">APN</div><div style="font-family:monospace;font-size:14px;">${esim.esim?.apn || 'redemae.internet'}</div></div>
                </div>
            </div>
            <div style="text-align:center;padding:20px;background:var(--dark);border-radius:12px;border:2px dashed var(--gray-700);">
                <div style="width:200px;height:200px;margin:0 auto 16px;background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify(esim.esim || {}))}" alt="QR Code eSIM" style="width:180px;height:180px;">
                </div>
                <p style="color:var(--gray-400);font-size:14px;">Escaneie o QR Code acima para instalar o eSIM no seu celular</p>
            </div>
            <button class="btn btn-outline w-full" style="margin-top:16px;" onclick="copiarDadosESIM()">Copiar dados do eSIM</button>
        </div>
    `;
}

function copiarDadosESIM() {
    const esim = JSON.parse(localStorage.getItem('esim') || '{}');
    const texto = `Rede Mãe eSIM\nICCID: ${esim.esim?.iccid}\nIMSI: ${esim.esim?.imsi}\nNúmero: ${esim.esim?.msisdn}\nAPN: ${esim.esim?.apn || 'redemae.internet'}\nKi: ${esim.esim?.ki}`;
    navigator.clipboard.writeText(texto).then(() => alert('Dados copiados!'));
}

function renderPlanosPage() {
    const container = document.getElementById('pageContent');
    container.innerHTML = '<p style="color:var(--gray-400);">Carregando planos...</p>';
    
    api.getPlanos().then(planos => {
        container.innerHTML = `
            <div class="planos-grid">
                ${planos.map(p => `
                    <div class="plano-card ${p.nome.includes('Power') || p.nome.includes('800') ? 'destaque' : ''}">
                        ${p.nome.includes('Power') ? '<div class="plano-destaque-tag">MAIS VENDIDO</div>' : ''}
                        <div class="plano-nome">${p.nome}</div>
                        <div class="plano-desc">${p.descricao || ''}</div>
                        <div class="plano-preco"><span class="valor">R$ ${parseFloat(p.preco_mensal).toFixed(2)}</span><span class="periodo">/mês</span></div>
                        <ul class="plano-features">
                            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ${p.velocidade_mbps} Mbps</li>
                            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ${p.franquia_gb} GB</li>
                            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ${p.permite_roteamento ? `Roteamento: até ${p.max_conexoes_roteadas} dispositivos` : 'Uso individual'}</li>
                        </ul>
                        <button class="btn ${p.nome.includes('Power') ? 'btn-primary' : 'btn-outline'}" onclick="contratarPlano('${p.id}')">Contratar</button>
                    </div>
                `).join('')}
            </div>
        `;
    }).catch(err => {
        container.innerHTML = `<p style="color:var(--danger);">Erro ao carregar planos.</p>`;
    });
}

async function contratarPlano(planoId) {
    if (!confirm('Confirmar contratação deste plano?')) return;
    try {
        const result = await api.contratarPlano(planoId, null);
        alert(result.mensagem);
        renderDashboard();
    } catch (err) {
        alert(err.error || 'Erro ao contratar plano.');
    }
}

function renderRoteador() {
    const container = document.getElementById('pageContent');
    container.innerHTML = `
        <div style="background:var(--gray-900);border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);max-width:600px;">
            <h3 style="margin-bottom:8px;">Modo Roteador</h3>
            <p style="color:var(--gray-400);margin-bottom:24px;">Ative o modo roteador no seu celular para compartilhar internet com outros dispositivos.</p>
            
            <div style="background:var(--dark);border-radius:12px;padding:24px;margin-bottom:24px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                    <div>
                        <div style="font-weight:600;">Status do roteador</div>
                        <div style="color:var(--gray-400);font-size:14px;">Modo roteador</div>
                    </div>
                    <label style="position:relative;display:inline-block;width:60px;height:32px;">
                        <input type="checkbox" id="toggleRoteador" style="opacity:0;width:0;height:0;" onchange="toggleRoteador(this.checked)">
                        <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:var(--gray-700);border-radius:32px;transition:0.3s;">
                            <span style="position:absolute;content:'';height:26px;width:26px;left:3px;bottom:3px;background:white;border-radius:50%;transition:0.3s;" id="toggleKnob"></span>
                        </span>
                    </label>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div><div style="font-size:12px;color:var(--gray-400);margin-bottom:4px;">Dispositivos conectados</div><div style="font-size:24px;font-weight:700;" id="dispConectados">0</div></div>
                    <div><div style="font-size:12px;color:var(--gray-400);margin-bottom:4px;">Dados compartilhados</div><div style="font-size:24px;font-weight:700;" id="dadosCompart">0 GB</div></div>
                </div>
            </div>
            
            <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:16px;">
                <p style="font-size:14px;color:var(--warning);">
                    <strong>Atenção:</strong> Ativar o modo roteador consome mais dados. Verifique seu plano antes de ativar.
                </p>
            </div>
        </div>
    `;
}

async function toggleRoteador(ativar) {
    try {
        const dispositivos = await api.getDispositivos();
        if (dispositivos.length === 0) {
            alert('Nenhum dispositivo encontrado. Certifique-se de que seu celular está conectado.');
            return;
        }
        const result = await api.ativarRoteador(dispositivos[0].id, ativar);
        const knob = document.getElementById('toggleKnob');
        if (ativar) {
            knob.style.transform = 'translateX(28px)';
            knob.style.background = 'var(--primary)';
        } else {
            knob.style.transform = 'translateX(0)';
            knob.style.background = 'white';
        }
        alert(result.mensagem);
    } catch (err) {
        alert(err.error || 'Erro ao alternar modo roteador.');
    }
}

function renderRecarga() {
    const container = document.getElementById('pageContent');
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:900px;">
            <div style="background:var(--gray-900);border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
                <h3 style="margin-bottom:24px;">Fazer recarga</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                    ${[10, 20, 30, 50, 100, 200].map(v => `
                        <button class="btn btn-outline" onclick="selecionarValor(${v})" id="valBtn${v}">R$ ${v.toFixed(2)}</button>
                    `).join('')}
                </div>
                <div class="form-group">
                    <label>Ou digite um valor</label>
                    <input type="number" id="valorPersonalizado" class="form-input" placeholder="R$ 10,00 a R$ 5.000,00" min="10" max="5000" step="5">
                </div>
                <button class="btn btn-primary btn-lg w-full" onclick="processarRecarga()">Gerar PIX</button>
            </div>
            <div style="background:var(--gray-900);border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
                <h3 style="margin-bottom:24px;">Histórico de recargas</h3>
                <p style="color:var(--gray-400);font-size:14px;">Últimas recargas aparecerão aqui.</p>
            </div>
        </div>
    `;
}

let valorSelecionado = 0;
function selecionarValor(valor) {
    valorSelecionado = valor;
    document.querySelectorAll('[id^="valBtn"]').forEach(b => b.classList.remove('btn-primary'));
    document.getElementById(`valBtn${valor}`).classList.add('btn-primary');
    document.getElementById('valorPersonalizado').value = '';
}

async function processarRecarga() {
    const valor = valorSelecionado || parseFloat(document.getElementById('valorPersonalizado').value);
    if (!valor || valor < 10) { alert('Valor mínimo: R$ 10,00'); return; }
    if (valor > 5000) { alert('Valor máximo: R$ 5.000,00'); return; }
    
    try {
        const result = await api.fazerRecarga(valor);
        if (result.codigo_pix) {
            document.getElementById('pageContent').innerHTML = `
                <div style="background:var(--gray-900);border-radius:16px;padding:32px;max-width:500px;text-align:center;">
                    <h3 style="margin-bottom:24px;">Pagamento via PIX</h3>
                    <div style="background:white;border-radius:12px;width:200px;height:200px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
                        <img src="${result.qrcode}" alt="QR Code PIX" style="width:180px;height:180px;">
                    </div>
                    <p style="color:var(--gray-400);font-size:14px;margin-bottom:16px;">Escaneie o QR Code ou copie o código PIX abaixo:</p>
                    <div style="background:var(--dark);border-radius:8px;padding:12px;font-family:monospace;font-size:12px;word-break:break-all;margin-bottom:16px;">${result.codigo_pix}</div>
                    <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${result.codigo_pix}').then(()=>alert('Código copiado!'))">Copiar código PIX</button>
                </div>
            `;
        }
    } catch (err) {
        alert(err.error || 'Erro ao gerar PIX.');
    }
}

function renderDispositivos() {
    const container = document.getElementById('pageContent');
    container.innerHTML = '<p style="color:var(--gray-400);">Carregando dispositivos...</p>';
    
    api.getDispositivos().then(dispositivos => {
        if (dispositivos.length === 0) {
            container.innerHTML = `
                <div style="background:var(--gray-900);border-radius:16px;padding:32px;text-align:center;">
                    <p style="color:var(--gray-400);margin-bottom:16px;">Nenhum dispositivo encontrado.</p>
                    <p style="color:var(--gray-600);font-size:14px;">Conecte seu celular à Rede Mãe para ele aparecer aqui.</p>
                </div>
            `;
            return;
        }
        container.innerHTML = `
            <div style="display:grid;gap:16px;">
                ${dispositivos.map(d => `
                    <div style="background:var(--gray-900);border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
                        <div>
                            <div style="font-weight:600;">${d.nome_dispositivo || d.modelo || 'Dispositivo'}</div>
                            <div style="color:var(--gray-400);font-size:13px;">${d.fabricante || ''} ${d.modelo || ''} | IMEI: ${d.imei || '--'}</div>
                            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                                <span style="width:8px;height:8px;border-radius:50%;background:${d.status === 'ativo' ? 'var(--success)' : 'var(--gray-600)'};display:inline-block;"></span>
                                <span style="font-size:13px;color:var(--gray-400);">${d.status}</span>
                                ${d.modo_roteador ? '<span style="font-size:12px;background:rgba(99,102,241,0.2);color:var(--primary-light);padding:4px 10px;border-radius:50px;">Roteador ativo</span>' : ''}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:13px;color:var(--gray-400);">${d.dispositivos_conectados || 0} conectados</div>
                            <div style="font-size:12px;color:var(--gray-600);">${d.ultimo_contato ? new Date(d.ultimo_contato).toLocaleString() : 'Nunca'}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }).catch(() => {
        container.innerHTML = '<p style="color:var(--danger);">Erro ao carregar dispositivos.</p>';
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('esim');
    window.location.href = 'index.html';
}
