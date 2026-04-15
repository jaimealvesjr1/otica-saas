// src/pages/Dashboard.tsx
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { formatarCodigo } from '../utils/geradores';
import { formatarCPF, formatarTelefone } from '../utils/mascaras';

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation(); 
  
  // --------------------------------------------------------
  // ⏳ LÓGICA DO CONTADOR REGRESSIVO DE TESTE
  // --------------------------------------------------------
  const [tempoRestante, setTempoRestante] = useState("");
  const dataFimTeste = new Date('2026-04-24T23:59:59').getTime();

  useEffect(() => {
    const intervalo = setInterval(() => {
      const agora = new Date().getTime();
      const distancia = dataFimTeste - agora;

      if (distancia < 0) {
        setTempoRestante("Teste Encerrado");
        clearInterval(intervalo);
      } else {
        const dias = Math.floor(distancia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60));
        setTempoRestante(`${dias}d ${horas}h ${minutos}m`);
      }
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  // --------------------------------------------------------
  // 🛡️ MOTOR DE AUTORIZAÇÕES (Controlo de Acessos)
  // --------------------------------------------------------
  const cargo = user?.cargo?.toLowerCase() || ''; 

  const isAdmin = cargo === 'admin';
  const isVendedor = cargo === 'vendedor';
  const isEstoquista = cargo === 'estoquista';
  const isGerente = cargo === 'gerente';

  // 🚀 NOVO: Vendedor agora pode ver o Dashboard
  const podeVerDashboard  = isAdmin || isGerente || isVendedor;
  const podeVerClientes   = isAdmin || isGerente || isVendedor;
  const podeVerVendas     = isAdmin || isGerente || isVendedor;
  const podeVerEstoque    = isAdmin || isGerente || isEstoquista;
  const podeVerFornecs    = isAdmin || isGerente || isEstoquista;
  const podeVerFinanceiro = isAdmin || isGerente;
  const podeVerRelatorios = isAdmin || isGerente;

  const rotasPermitidas: Record<string, boolean> = {
    '/': podeVerDashboard,
    '/clientes': podeVerClientes,
    '/vendas': podeVerVendas,
    '/estoque': podeVerEstoque,
    '/fornecedores': podeVerFornecs,
    '/receber': podeVerFinanceiro,
    '/relatorios': podeVerRelatorios,
  };

  const temPermissao = rotasPermitidas[location.pathname] === true;

  // --------------------------------------------------------
  // Indicadores
  // --------------------------------------------------------
  const [vendasHoje, setVendasHoje] = useState(0);
  const [vendasMes, setVendasMes] = useState(0);
  const [receberTotal, setReceberTotal] = useState(0);
  const [estoqueBaixo, setEstoqueBaixo] = useState(0);
  const [ultimasVendas, setUltimasVendas] = useState<any[]>([]);

  // --------------------------------------------------------
  // LÓGICA DO PERFIL DE USUÁRIO
  // --------------------------------------------------------
  const [modalPerfil, setModalPerfil] = useState(false);
  const [perfilNome, setPerfilNome] = useState('');
  const [perfilCpf, setPerfilCpf] = useState('');
  const [perfilNascimento, setPerfilNascimento] = useState('');
  const [perfilTelefone, setPerfilTelefone] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  const abrirPerfil = () => { 
    setPerfilNome(user?.nome || ''); 
    setPerfilCpf(user?.cpf || '');
    setPerfilNascimento(user?.dataNascimento || '');
    setPerfilTelefone(user?.telefone || '');
    setNovaSenha('');
    setModalPerfil(true); 
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'colaboradores', user.uid), {
          nome: perfilNome, 
          cpf: perfilCpf, 
          dataNascimento: perfilNascimento, 
          telefone: perfilTelefone
        });
      }
      if (novaSenha && auth.currentUser) {
        await updatePassword(auth.currentUser, novaSenha);
      }
      alert('Perfil atualizado com sucesso! (As mudanças completas refletirão no próximo login).'); 
      setModalPerfil(false);
    } catch (error) { 
      alert('Erro ao atualizar perfil.'); 
    }
  };

  useEffect(() => {
    const carregarIndicadores = async () => {
      if (!podeVerDashboard) return; 
      
      const hoje = new Date().toISOString().split('T')[0];
      const mesAtual = hoje.substring(0, 7);

      const vendasSnap = await getDocs(collection(db, 'vendas'));
      let totalHoje = 0; let totalMes = 0; let totalReceber = 0;
      const listaVendas: any[] = [];

      vendasSnap.forEach(doc => {
        const v = doc.data();
        
        // 🚀 NOVO: Se for vendedor, ignora as vendas dos outros colegas
        if (isVendedor && v.vendedor !== user?.nome) return;

        listaVendas.push({ id: doc.id, ...v });
        if (v.dataVenda === hoje) totalHoje += v.valorTotal;
        if (v.dataVenda.startsWith(mesAtual)) totalMes += v.valorTotal;
        if (v.formaPagamento === 'Carnê' && v.carne && !v.carne.quitado) totalReceber += v.carne.restante;
      });

      setVendasHoje(totalHoje); setVendasMes(totalMes); setReceberTotal(totalReceber);
      listaVendas.sort((a, b) => b.numeroTalao - a.numeroTalao);
      setUltimasVendas(listaVendas.slice(0, 5));

      // 🚀 NOVO: O Vendedor não precisa carregar dados de estoque
      if (isAdmin || isGerente || isEstoquista) {
        const estoqueSnap = await getDocs(collection(db, 'estoque'));
        let itensBaixos = 0;
        estoqueSnap.forEach(doc => { if (doc.data().quantidade <= 3) itensBaixos++; });
        setEstoqueBaixo(itensBaixos);
      }
    };
    
    // Atualiza toda vez que o user mudar para garantir que pegou o nome correto
    if (user?.nome) carregarIndicadores();
  }, [user, podeVerDashboard, isVendedor, isAdmin, isGerente, isEstoquista]);

  const handleLogout = async () => { await signOut(auth); };
  const linkAtivo = (caminho: string) => location.pathname === caminho ? '#007bff' : 'transparent';
  const corTextoLink = (caminho: string) => location.pathname === caminho ? 'white' : '#b8c2cc';

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* MENU LATERAL */}
      <nav className="no-print" style={{ width: '250px', flexShrink: 0, backgroundColor: '#1e293b', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #334155', backgroundColor: 'white' }}>
          <img src="/logo.png" alt="Ótica Milenium" style={{ maxWidth: '180px', maxHeight: '60px' }} />
        </div>
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          
          <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Menu Principal</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            {podeVerDashboard && (
              <li><Link to="/" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/'), color: corTextoLink('/') }}>🏠 Início</Link></li>
            )}
            
            {podeVerClientes && (
              <li><Link to="/clientes" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/clientes'), color: corTextoLink('/clientes') }}>👥 Clientes</Link></li>
            )}
            
            {podeVerVendas && (
              <li><Link to="/vendas" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/vendas'), color: corTextoLink('/vendas') }}>💰 Vendas</Link></li>
            )}
            
            {podeVerEstoque && (
              <li><Link to="/estoque" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/estoque'), color: corTextoLink('/estoque') }}>📦 Estoque</Link></li>
            )}
            
            {podeVerFornecs && (
              <li><Link to="/fornecedores" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/fornecedores'), color: corTextoLink('/fornecedores') }}>🤝 Fornecedores</Link></li>
            )}
            
            {(podeVerFinanceiro || podeVerRelatorios) && (
              <>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '20px', marginBottom: '10px' }}>Gestão & Financeiro</p>
                {podeVerFinanceiro && (
                  <li><Link to="/receber" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/receber'), color: corTextoLink('/receber') }}>💸 Contas a Receber</Link></li>
                )}
                {podeVerRelatorios && (
                  <li><Link to="/relatorios" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/relatorios'), color: corTextoLink('/relatorios') }}>📊 Relatórios</Link></li>
                )}
              </>
            )}
          </ul>
        </div>

        {/* CAIXA DE CONTAGEM REGRESSIVA AQUI */}
        <div style={{ margin: '10px', padding: '15px', background: '#334155', borderRadius: '8px', border: '1px solid #475569' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Período de Experiência</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#fbbf24' }}>⌛ {tempoRestante}</p>
        </div>

        <div style={{ padding: '15px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div onClick={abrirPerfil} style={{ fontSize: '14px', cursor: 'pointer', flex: 1 }} title="Clique para editar seu perfil">
            <span style={{ display: 'block', fontWeight: 'bold' }}>{user?.nome} ⚙️</span>
            <span style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'capitalize' }}>{cargo || 'Sem Cargo'}</span>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Sair</button>
        </div>
      </nav>

      {/* ÁREA CENTRAL E FOOTER */}
      <main style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: '#f8fafc', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        
        {temPermissao ? (
          <div style={{ flex: 1 }}>
            {window.location.pathname === '/' && podeVerDashboard && (
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ marginTop: 0, color: '#1e293b', marginBottom: '20px' }}>
                  {isVendedor ? '🎯 Meu Desempenho' : 'Painel de Controle Estratégico'}
                </h2>
                
                {/* 🚀 NOVO: Grid ajustável se for vendedor ou admin */}
                <div style={{ display: 'grid', gridTemplateColumns: (isAdmin || isGerente) ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '5px solid #10b981' }}>
                    <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>Vendido Hoje</p>
                    <h2 style={{ margin: '10px 0 0 0', color: '#0f172a', fontSize: '24px' }}>{vendasHoje.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h2>
                  </div>
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '5px solid #3b82f6' }}>
                    <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>Vendido no Mês</p>
                    <h2 style={{ margin: '10px 0 0 0', color: '#0f172a', fontSize: '24px' }}>{vendasMes.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h2>
                  </div>
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '5px solid #f59e0b' }}>
                    <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>{isVendedor ? 'A Receber (Minhas Vendas)' : 'A Receber (Carnês)'}</p>
                    <h2 style={{ margin: '10px 0 0 0', color: '#0f172a', fontSize: '24px' }}>{receberTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h2>
                  </div>
                  
                  {/* Oculta Alerta de Estoque para o Vendedor */}
                  {(isAdmin || isGerente) && (
                    <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '5px solid #ef4444' }}>
                      <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>Alertas de Estoque</p>
                      <h2 style={{ margin: '10px 0 0 0', color: '#0f172a', fontSize: '24px' }}>{estoqueBaixo} produtos</h2>
                    </div>
                  )}
                </div>
                
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>
                    {isVendedor ? 'Minhas Últimas Vendas' : 'Últimas Vendas Realizadas'}
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Talão</th><th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Data</th><th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Cliente</th>
                        {/* Se for gerente ou admin, é bom mostrar qual vendedor fez a venda */}
                        {(!isVendedor) && <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Vendedor</th>}
                        <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Pagamento</th><th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimasVendas.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '15px', textAlign: 'center' }}>Nenhuma venda encontrada.</td></tr>
                      ) : (
                        ultimasVendas.map(v => (
                          <tr key={v.id}>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>{formatarCodigo(v.numeroTalao)}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{v.dataVenda.split('-').reverse().join('/')}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{v.clienteNome}</td>
                            {(!isVendedor) && <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{v.vendedor || '-'}</td>}
                            <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}><span style={{ background: v.formaPagamento === 'Carnê' ? '#fef3c7' : '#dcfce7', color: v.formaPagamento === 'Carnê' ? '#92400e' : '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{v.formaPagamento}</span></td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>{v.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Outlet />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <h1 style={{ fontSize: '60px', margin: 0 }}>⛔</h1>
            <h2 style={{ color: '#ef4444' }}>Acesso Negado</h2>
            <p style={{ color: '#64748b' }}>O seu cargo de <strong>{cargo || 'Utilizador'}</strong> não tem permissão para visualizar esta página.</p>
            <p style={{ color: '#64748b' }}>Se acha que isto é um erro, contacte o Administrador do sistema.</p>
          </div>
        )}

        <footer className="no-print" style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div><p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} · <span style={{ background: 'green', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#ffffff' }}>Alpha v1.0.2 - Ajustes no prontuário do cliente</span></p></div>
          <div style={{ textAlign: 'right' }}><p style={{ margin: 0, fontSize: '12px' }}>🚀 by <img src="/icon_ascentia.png" alt="Ascentia" style={{ height: '1.2em', verticalAlign: 'middle', opacity: 0.7, margin: '0 4px' }} /><strong>Ascentia</strong> · para <strong>Ótica Milenium</strong><br/><em>Tecnologia com propósito!</em></p></div>
        </footer>
      </main>

      {/* 🚀 MODAL DE PERFIL REFORMULADO E BONITO */}
      {modalPerfil && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-formulario" style={{ width: '500px', backgroundColor: 'white', borderRadius: '8px', padding: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            
            <h2 style={{ marginTop: 0, color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px' }}>
              👤 Meu Perfil e Acessos
            </h2>

            <form onSubmit={salvarPerfil} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#475569', display: 'block', marginBottom: '5px' }}>Nome Completo</label>
                <input type="text" value={perfilNome} onChange={e => setPerfilNome(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#475569', display: 'block', marginBottom: '5px' }}>CPF</label>
                <input type="text" value={perfilCpf} onChange={e => setPerfilCpf(formatarCPF(e.target.value))} maxLength={14} placeholder="000.000.000-00" style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#475569', display: 'block', marginBottom: '5px' }}>Data de Nascimento</label>
                <input type="date" value={perfilNascimento} onChange={e => setPerfilNascimento(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#475569', display: 'block', marginBottom: '5px' }}>Celular / Telefone</label>
                <input type="text" value={perfilTelefone} onChange={e => setPerfilTelefone(formatarTelefone(e.target.value))} maxLength={15} placeholder="(00) 00000-0000" style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#0284c7', display: 'block', marginBottom: '5px' }}>Nova Senha (Opcional)</label>
                <input type="password" placeholder="Digite se quiser alterar..." value={novaSenha} onChange={e => setNovaSenha(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '2px solid #bae6fd', boxSizing: 'border-box' }} />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" style={{ flex: 1, background: '#10b981', color: 'white', padding: '12px', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>💾 Salvar Alterações</button>
                <button type="button" onClick={() => setModalPerfil(false)} style={{ background: '#ef4444', color: 'white', padding: '12px', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
