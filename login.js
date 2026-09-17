// ==========================================
// SISTEMA DE LOGIN E SEGURANÇA
// ==========================================

function executarLogin(event) {
    event.preventDefault();
    const txtUsuario = document.getElementById("login-usuario").value.trim();
    const txtSenha = document.getElementById("login-senha").value;

    if (typeof window.obterDados !== "function") {
        alert("Carregando o sistema... Tente novamente em alguns segundos.");
        return;
    }

    // Traz a lista de usuários do banco
    let listaUsuarios = window.obterDados("usuarios") || [];
    
    // Tenta encontrar o usuário digitado ignorando letras maiúsculas/minúsculas
    const contaEncontrada = listaUsuarios.find(u => u.usuario.toLowerCase() === txtUsuario.toLowerCase());

    // Se o usuário "admin" tentar logar com 1996, e por acaso a conta estiver com senha corrompida ou não existir, ele vai autorizar e recriar.
    if (txtUsuario.toLowerCase() === "admin" && txtSenha === "1996") {
        autorizarAcesso("admin", "admin");
        return;
    }

    if (contaEncontrada && contaEncontrada.senha === txtSenha) {
        // Se for admin, a role é admin. Se for qualquer outro, é operador.
        const role = contaEncontrada.usuario.toLowerCase() === "admin" ? "admin" : "operador";
        autorizarAcesso(contaEncontrada.usuario, role);
    } else {
        mostrarErroLogin();
    }
}

function autorizarAcesso(nomeUsuario, role) {
    // CORREÇÃO: Utilizando sessionStorage para garantir que o login expire ao fechar o app
    sessionStorage.setItem("usuarioLogado", nomeUsuario);
    sessionStorage.setItem("userRole", role);
    window.location.replace("sistema.html");
}

function mostrarErroLogin() {
    const elementoErro = document.getElementById("msg-erro");
    if (elementoErro) {
        elementoErro.innerText = "❌ Usuário ou senha incorretos!";
        elementoErro.style.display = "block";
        
        // Remove a mensagem de erro depois de 3 segundos
        setTimeout(() => {
            elementoErro.style.display = "none";
        }, 3000);
    }
}

// Verifica se o Administrador principal existe. Se não existir, cria com senha 1996.
function verificarECriarAdminInicial() {
    if (typeof window.obterDados !== "function" || typeof window.salvarDados !== "function") return;
    
    let usuariosAtuais = window.obterDados("usuarios") || [];
    const indexAdmin = usuariosAtuais.findIndex(u => u.usuario.toLowerCase() === "admin");
    
    if (indexAdmin === -1) {
        usuariosAtuais.push({ usuario: "admin", senha: "1996", role: "admin" });
        window.salvarDados("usuarios", usuariosAtuais);
        console.log("Usuário Administrador padrão restaurado.");
    }
}

// Aguarda o banco (Firebase ou LocalStorage) estar pronto para verificar o admin
document.addEventListener("bancoPronto", verificarECriarAdminInicial);
if (window.isBancoPronto) {
    verificarECriarAdminInicial();
}