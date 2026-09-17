import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 0. FUNÇÕES GLOBAIS DE LEITURA 
// ==========================================
window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};
window.salvarDados = window.salvarDados || function(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
};

const configSalva = localStorage.getItem("firebaseConfigJSON");
let app, db;
window.isBancoPronto = false;
let isSyncingFromCloud = false;

// TRAVA DE EMERGÊNCIA INSTANTÂNEA (Sem delay de internet)
const isLockedLocally = localStorage.getItem('saas_locked') === 'true';

// ==========================================
// 1. CRIAÇÃO DAS TELAS DE BLOQUEIO E AVISOS
// ==========================================
function injetarTelaBloqueioEAvisos() {
    // Verifica se é a página de login (pelo formulário). Se for, aborta a injeção.
    if (document.getElementById("form-login")) return;

    if(document.getElementById("tela-bloqueio-saas")) return;

    // 1. Tela de Bloqueio (Já carrega como 'flex' instantaneamente se bloqueado)
    const divLock = document.createElement("div");
    divLock.id = "tela-bloqueio-saas";
    divLock.style.cssText = `display:${isLockedLocally ? 'flex' : 'none'}; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(11, 14, 20, 0.95); z-index:9999999; flex-direction:column; align-items:center; justify-content:center; color:white; font-family: 'Segoe UI', sans-serif; backdrop-filter:blur(5px);`;
    
    divLock.innerHTML = `
        <div style="background:#161d2b; padding:40px; border-radius:12px; border:2px solid #ef4444; text-align:center; max-width:90%; width: 400px; box-shadow:0 10px 50px rgba(0,0,0,0.8);">
            <h1 style="color:#ef4444; font-size:60px; margin:0;">🔒</h1>
            <h2 style="margin:15px 0; font-size:26px; color:#fff;">ACESSO SUSPENSO</h2>
            <p id="texto-motivo-bloqueio" style="font-size:16px; color:#94a3b8; line-height:1.5;">O sistema foi bloqueado pelo administrador.</p>
            <img id="qr-pix-bloqueio" style="max-width:200px; border-radius:8px; display:none; margin: 20px auto 0 auto;">
        </div>
    `;
    document.body.appendChild(divLock);

    // 2. Faixa de Aviso Global/Cobrança (Corrigida)
    const divAviso = document.createElement("div");
    divAviso.id = "faixa-aviso-saas";
    divAviso.style.cssText = "display:none; width:100%; background:#f59e0b; color:#fff; text-align:center; padding:12px; font-weight:bold; font-size:15px; font-family:'Segoe UI', sans-serif; position:relative; z-index:9999998; box-shadow:0 4px 10px rgba(0,0,0,0.3); box-sizing:border-box;";
    
    document.body.prepend(divAviso);
}

// Injeta visual imediatamente na página
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injetarTelaBloqueioEAvisos);
} else {
    injetarTelaBloqueioEAvisos();
}

// ==========================================
// 2. INICIALIZAÇÃO DO BANCO
// ==========================================
if (configSalva) {
    try {
        const firebaseConfig = JSON.parse(configSalva);
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        window.isBancoPronto = true;
        document.dispatchEvent(new Event('bancoPronto'));
        console.log("Firebase conectado com sucesso!");
        
        escutarNuvem();
        iniciarMonitoramentoSaaS();

        // SINCRONIZAÇÃO INICIAL AUTOMÁTICA
        if (!localStorage.getItem("sincronizacao_inicial_feita")) {
            console.log("Iniciando sincronização forçada dos dados antigos...");
            const chavesLocais = Object.keys(localStorage);
            
            for (let chave of chavesLocais) {
                if (chave !== "sincronizacao_inicial_feita" && chave !== "saas_locked") {
                    let valor = localStorage.getItem(chave);
                    localStorage.setItem(chave, valor); 
                }
            }
            localStorage.setItem("sincronizacao_inicial_feita", "true");
        }

    } catch (error) {
        console.error("Erro credenciais:", error);
        window.isBancoPronto = true;
        document.dispatchEvent(new Event('bancoPronto'));
    }
} else {
    window.isBancoPronto = true; 
    document.dispatchEvent(new Event('bancoPronto'));
}

// ==========================================
// 3. GRAVAÇÃO NA NUVEM
// ==========================================
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
   const chavesIgnoradas = ["firebaseConfigJSON", "temaCorFundoHeader", "temaCorTextoHeader", "fundoTelaSistema", "caixa_aberto_status", "caixa_valor_abertura", "saas_locked", "sincronizacao_inicial_feita"];
    
    if (!isSyncingFromCloud && window.isBancoPronto && db && !chavesIgnoradas.includes(key)) {
        try {
            let parsedValue = JSON.parse(value);
            setDoc(doc(db, 'estoque_bekas', key), { valor: parsedValue }).catch(()=>{});
        } catch(e) {
            setDoc(doc(db, 'estoque_bekas', key), { valor: value }).catch(()=>{});
        }
    }
};

// ==========================================
// 4. RECEPÇÃO DA NUVEM
// ==========================================
function escutarNuvem() {
    onSnapshot(collection(db, 'estoque_bekas'), (snapshot) => {
        let houveMudanca = false;
        snapshot.forEach((docSnap) => {
            const chave = docSnap.id;
            const dadosNuvem = docSnap.data().valor;
            const dadoLocalStr = localStorage.getItem(chave);
            const dadoNuvemStr = typeof dadosNuvem === 'object' ? JSON.stringify(dadosNuvem) : String(dadosNuvem);
            
            if (dadoLocalStr !== dadoNuvemStr) {
                isSyncingFromCloud = true;
                originalSetItem.call(localStorage, chave, dadoNuvemStr);
                isSyncingFromCloud = false; 
                houveMudanca = true;
            }
        });
        if (houveMudanca) {
            document.dispatchEvent(new Event('dadosAtualizados'));
            document.dispatchEvent(new Event('bancoPronto')); 
        }
    });
}

// ==========================================
// 5. CONTROLE SaaS MASTER (Bloqueios, Avisos, Módulos e Fundo)
// ==========================================
export function iniciarMonitoramentoSaaS() {
    if (!db) return; 

    const licencaRef = doc(db, "config", "licenca");
    
    onSnapshot(licencaRef, (docSnap) => {
        const tela = document.getElementById("tela-bloqueio-saas");
        const texto = document.getElementById("texto-motivo-bloqueio");
        const qrCode = document.getElementById("qr-pix-bloqueio");
        const faixaAviso = document.getElementById("faixa-aviso-saas");
        const ehPaginaLogin = !!document.getElementById("form-login");
        
        if (docSnap.exists()) {
            const dados = docSnap.data();
            
            // Grava a trava localmente independente da página
            if (dados.bloqueado) {
                localStorage.setItem('saas_locked', 'true');
            } else {
                localStorage.removeItem('saas_locked');
            }

            // Se for a página de login, encerra aqui para não alterar visual (fundo/alertas/módulos)
            if (ehPaginaLogin) return;

            // LÓGICA DE BLOQUEIO VISUAL
            if (dados.bloqueado) {
                if(texto) texto.innerText = dados.mensagem || "O sistema foi bloqueado pelo administrador.";
                if(dados.qrCode && qrCode) { qrCode.src = dados.qrCode; qrCode.style.display = "block"; } else if (qrCode) { qrCode.style.display = "none"; }
                if(tela) tela.style.display = "flex";
            } else {
                if(tela) tela.style.display = "none";
            }

            // LÓGICA DA FAIXA DE AVISOS
            let textoAviso = "";
            if (dados.avisoGlobal && String(dados.avisoGlobal).trim() !== "") {
                textoAviso = dados.avisoGlobal;
            } else if (dados.aviso && String(dados.aviso).trim() !== "") {
                textoAviso = dados.aviso;
            }

            if (textoAviso !== "") {
                if(faixaAviso) {
                    faixaAviso.innerHTML = `⚠️ ${textoAviso}`;
                    faixaAviso.style.display = "block";
                }
            } else {
                if(faixaAviso) faixaAviso.style.display = "none";
            }

            // LÓGICA DO FUNDO DE TELA (Wallpaper)
            if (dados.imagemFundo && dados.imagemFundo.trim() !== "") {
                document.body.style.setProperty('background-image', `url(${dados.imagemFundo})`, 'important');
                document.body.style.setProperty('background-size', 'cover', 'important');
                document.body.style.setProperty('background-position', 'center', 'important');
                document.body.style.setProperty('background-attachment', 'fixed', 'important');
            } else {
                if (document.body.style.getPropertyPriority('background-image') === 'important') {
                    document.body.style.removeProperty('background-image');
                }
            }

            // LÓGICA DOS MÓDULOS
            const mods = dados.modulosLiberados || {};
            const controleVisual = {
                "mod_caixa": ["card-caixa"],
                "mod_cupons": ["card-cupons"],
                "mod_cozinha": ["card-cozinha"],
                "mod_fidelidade": ["card-fidelidade"],
                "mod_registrar_produto": ["card-registrar_produto"],
                "mod_todos_produtos": ["card-todos_produtos"],
                "mod_verificar_quantidade": ["card-verificar_quantidade"],
                "mod_fim_estoque": ["card-fim_estoque"],
                "mod_faturamento": ["card-faturamento"],
                "mod_relatorios": ["card-relatorio"],
                "mod_apagar_tudo": ["zona-apagar-tudo"],
                "mod_admin_firebase": ["btn-menu-conectar-firebase"],
                "mod_admin_permissoes": ['button[onclick="abrirModalPermissoes()"]'],
                "mod_admin_senhas": ['button[onclick="abrirModalSenhasSistema()"]'],
                "mod_admin_config": ["btn-menu-config-emp"],
                "mod_admin_usuarios": ["btn-menu-criar-usu", "btn-menu-editar-usu", "btn-menu-excluir-usu", "btn-menu-ver-usu"]
            };

            for (const [modKey, seletores] of Object.entries(controleVisual)) {
                let liberado = (modKey === "mod_apagar_tudo") ? (mods[modKey] === true) : (mods[modKey] !== false);
                
                seletores.forEach(seletor => {
                    let elemento = document.getElementById(seletor);
                    if (!elemento && seletor.includes('[')) {
                        elemento = document.querySelector(seletor);
                    }
                    
                    if (elemento) {
                        if (!liberado) elemento.style.setProperty('display', 'none', 'important');
                        else if (elemento.style.getPropertyPriority('display') === 'important') elemento.style.removeProperty('display');
                    }
                });
            }
        } else {
            localStorage.removeItem('saas_locked');
            if(tela) tela.style.display = "none";
            if(faixaAviso) faixaAviso.style.display = "none";
        }
    });
}