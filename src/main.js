import './style.css'
import { supabase } from './lib/supabase'

// Mocking auth user for demonstration if not authenticated
const getUserId = () => {
  // In a real app, you'd use supabase.auth.getUser()
  return 'mock-vendedor-id'
}

async function carregarEntregas() {
  try {
    const userId = getUserId()
    const { data, error } = await supabase
      .from('entregas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar entregas:', error);
      return [];
    }
    return data;
  } catch (err) {
    console.error('Erro inesperado:', err);
    return [];
  }
}

const getInitials = (name) => {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function renderEntregas(entregas) {
  const tbody = document.getElementById('pedidos-tbody');
  const cardContainer = document.getElementById('pedidos-cards-mobile');

  if (!tbody || !cardContainer) return;

  if (!entregas || entregas.length === 0) {
    const emptyState = `
      <div class="flex flex-col items-center gap-2 opacity-50 py-12 text-center w-full">
         <i class="ph ph-tray text-4xl text-slate-400"></i>
         <span class="text-slate-400 font-bold">Nenhum pedido encontrado hoje.</span>
      </div>
    `;
    tbody.innerHTML = `<tr><td colspan="4">${emptyState}</td></tr>`;
    cardContainer.innerHTML = emptyState;
    updateStats(0, 0);
    return;
  }

  // Render Desktop Table
  tbody.innerHTML = entregas.map(entrega => `
    <tr data-entrega-id="${entrega.id}" class="group hover:bg-slate-50/80 transition-all cursor-pointer">
      <td class="px-8 py-6">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
            ${getInitials(entrega.cliente_nome)}
          </div>
          <div>
            <p class="font-bold text-slate-800">${entrega.cliente_nome || 'Sem Nome'}</p>
            <p class="text-xs text-slate-400">Pedido #${entrega.id.toString().slice(-5)}</p>
          </div>
        </div>
      </td>
      <td class="px-8 py-6">
        <span class="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-mono font-black text-lg group-hover:bg-white border border-transparent group-hover:border-slate-100 transition-all">
          ${entrega.codigo_acesso}
        </span>
      </td>
      <td class="px-8 py-6">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full ${entrega.status === 'pendente' ? 'bg-orange-400 animate-pulse' : 'bg-blue-500'}"></span>
          <span class="text-sm font-bold ${entrega.status === 'pendente' ? 'text-orange-600' : 'text-blue-600'} uppercase tracking-tighter">
            ${entrega.status === 'pendente' ? 'Aguardando GPS' : 'Localizado'}
          </span>
        </div>
      </td>
      <td class="px-8 py-6 text-right">
        <div class="p-3 text-slate-300 group-hover:text-blue-600 transition-all">
          <i class="ph-bold ph-caret-right text-xl"></i>
        </div>
      </td>
    </tr>
  `).join('');

  // Render Mobile Cards
  cardContainer.innerHTML = entregas.map(entrega => `
    <div data-entrega-id="${entrega.id}" class="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm relative group active:scale-[0.98] transition-all cursor-pointer">
      <div class="flex items-center gap-4">
        <!-- Blue Numeric Code -->
        <div class="text-blue-600 font-mono font-black text-xl tracking-tight">
          ${entrega.codigo_acesso}
        </div>
        
        <div class="flex-1">
          <h5 class="font-bold text-slate-800 leading-none mb-1.5">${entrega.cliente_nome || 'Sem Nome'}</h5>
          
          <!-- Status below name -->
          <div class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full ${entrega.status === 'pendente' ? 'bg-orange-400' : 'bg-blue-500'}"></span>
            <span class="text-[10px] font-black uppercase tracking-tighter ${entrega.status === 'pendente' ? 'text-orange-600' : 'text-blue-600'}">
              ${entrega.status === 'pendente' ? 'Pendente' : 'Confirmado'}
            </span>
          </div>
        </div>

        <div class="text-slate-300">
          <i class="ph-bold ph-caret-right text-lg"></i>
        </div>
      </div>
    </div>
  `).join('');

  // Update stats
  const pendentes = entregas.filter(e => e.status === 'pendente').length;
  const localizadas = entregas.filter(e => e.status === 'localizado').length;
  updateStats(pendentes, localizadas);
}

function getStatusClass(status) {
  switch (status) {
    case 'Pendente': return 'bg-orange-100/80 text-orange-700';
    case 'Localizado': return 'bg-blue-100/80 text-blue-700';
    case 'Em Rota': return 'bg-slate-100/80 text-slate-700';
    default: return 'bg-slate-100 text-slate-500';
  }
}

function updateStats(pendentes, localizadas) {
  const pEl = document.getElementById('stat-pendentes');
  const lEl = document.getElementById('stat-localizadas');

  if (pEl) pEl.textContent = pendentes.toString().padStart(2, '0');
  if (lEl) lEl.textContent = localizadas.toString().padStart(2, '0');
}

// Initial load
// Local state
let allEntregas = [];

async function refreshData() {
  allEntregas = await carregarEntregas();
  renderEntregas(allEntregas);
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Porto Geoloc initialized');
  await refreshData();

  // Setup Event Delegation for Cards
  const tbody = document.getElementById('pedidos-tbody');
  const cardContainer = document.getElementById('pedidos-cards-mobile');

  const handleCardClick = (e) => {
    const row = e.target.closest('[data-entrega-id]');
    if (row) {
      const id = row.getAttribute('data-entrega-id');
      const entrega = allEntregas.find(ent => ent.id == id);
      if (entrega) {
        window.openOrderOptions(entrega);
      }
    }
  };

  if (tbody) tbody.addEventListener('click', handleCardClick);
  if (cardContainer) cardContainer.addEventListener('click', handleCardClick);
});

async function criarEntrega(nome, telefone, rua, bairro, numero, referencia) {
  // Generate random 4-digit numeric code
  const codigoAcesso = Math.floor(1000 + Math.random() * 9000).toString();

  const { data, error } = await supabase
    .from('entregas')
    .insert([
      {
        cliente_nome: nome,
        cliente_telefone: telefone,
        cliente_rua: rua,
        cliente_bairro: bairro,
        cliente_numero: numero,
        cliente_referencia: referencia,
        codigo_acesso: codigoAcesso,
        status: 'pendente'
      }
    ])
    .select();

  if (error) {
    console.error('Erro ao criar entrega:', error);
    alert('Erro ao criar entrega. Verifique as configurações do Supabase.');
    return null;
  }

  await window.refreshEntregas();
  return data;
}

// State for sharing
let currentSharing = { id: null, code: null };

window.openOrderOptions = (entrega) => {
  currentSharing = { id: entrega.id, code: entrega.codigo_acesso };

  // Update modal info
  document.getElementById('options-client-name').textContent = entrega.cliente_nome || 'Sem Nome';
  document.getElementById('options-order-id').textContent = `Pedido #${entrega.id.toString().slice(-5)}`;

  const btnDetails = document.getElementById('btn-view-details');
  const btnMaps = document.getElementById('btn-open-maps');
  const btnShare = document.getElementById('btn-share-option');

  // Handle Details button
  btnDetails.onclick = () => {
    document.getElementById('modal-order-options').classList.add('hidden');
    openDeliveryDetails(entrega);
  };

  // Handle Maps button
  if (entrega.latitude && entrega.longitude) {
    btnMaps.classList.remove('opacity-50', 'pointer-events-none');
    btnMaps.onclick = () => {
      window.open(`https://www.google.com/maps/search/?api=1&query=${entrega.latitude},${entrega.longitude}`, '_blank');
    };
  } else {
    btnMaps.classList.add('opacity-50', 'pointer-events-none');
    btnMaps.onclick = null;
  }

  // Handle Share button
  btnShare.onclick = () => {
    document.getElementById('modal-order-options').classList.add('hidden');
    window.openShareModal(entrega.id, entrega.codigo_acesso);
  };

  document.getElementById('modal-order-options').classList.remove('hidden');
}

function openDeliveryDetails(entrega) {
  const modal = document.getElementById('modal-details');

  // Fill text data
  document.getElementById('details-nome').textContent = entrega.cliente_nome || 'Não informado';
  document.getElementById('details-rua').textContent = entrega.cliente_rua || 'Não informado';
  document.getElementById('details-bairro').textContent = entrega.cliente_bairro || 'Não informado';
  document.getElementById('details-numero').textContent = entrega.cliente_numero || 'S/N';
  document.getElementById('details-referencia').textContent = entrega.cliente_referencia || 'Nenhum ponto de referência';

  // Handle Photo
  const img = document.getElementById('details-photo');
  const empty = document.getElementById('details-photo-empty');

  if (entrega.foto_url) {
    img.src = entrega.foto_url;
    img.classList.remove('hidden');
    empty.classList.add('hidden');
  } else {
    img.src = '';
    img.classList.add('hidden');
    empty.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
}

window.zoomPhoto = (src) => {
  if (!src) return;
  const zoomImg = document.getElementById('zoom-img');
  const modal = document.getElementById('modal-photo-zoom');
  zoomImg.src = src;
  modal.classList.remove('hidden');
}

window.openShareModal = (id, code) => {
  currentSharing = { id, code };
  document.getElementById('modal-share').classList.remove('hidden');
}

window.copyDeliveryLink = () => {
  const url = `${window.location.origin}/confirmar-localizacao?id=${currentSharing.id}`;
  navigator.clipboard.writeText(url).then(() => {
    // Show Toast
    const toast = document.getElementById('toast');
    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
    }, 2000);

    document.getElementById('modal-share').classList.add('hidden');
  });
}

window.showQRCode = () => {
  const url = `${window.location.origin}/confirmar-localizacao?id=${currentSharing.id}`;
  const container = document.getElementById('qrcode-container');
  container.innerHTML = '';

  new QRCode(container, {
    text: url,
    width: 256,
    height: 256,
    colorDark: "#1a365d", // Deep Navy Blue
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('modal-share').classList.add('hidden');
  document.getElementById('modal-qrcode-display').classList.remove('hidden');
}

window.showUniversalQRCode = () => {
  const url = `${window.location.origin}/confirmar-localizacao`;
  const container = document.getElementById('qrcode-container');
  container.innerHTML = '';

  new QRCode(container, {
    text: url,
    width: 256,
    height: 256,
    colorDark: "#1e293b", // Slate 800
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('modal-qrcode-display').classList.remove('hidden');
}

// Expose functions for buttons
window.refreshEntregas = async () => {
  await refreshData();
}

window.handleCreateEntrega = async () => {
  const nomeInput = document.getElementById('input-nome');
  const telInput = document.getElementById('input-telefone');
  const ruaInput = document.getElementById('input-rua');
  const bairroInput = document.getElementById('input-bairro');
  const numeroInput = document.getElementById('input-numero');
  const refInput = document.getElementById('input-referencia');
  const btn = document.getElementById('btn-confirmar');

  if (!nomeInput?.value || !telInput?.value) {
    alert('Nome e Telefone são obrigatórios');
    return;
  }

  const originalText = btn.innerHTML;
  btn.innerHTML = 'Solicitando...';
  btn.disabled = true;

  const result = await criarEntrega(
    nomeInput.value,
    telInput.value,
    ruaInput?.value || '',
    bairroInput?.value || '',
    numeroInput?.value || '',
    refInput?.value || ''
  );

  if (result) {
    document.getElementById('modal-overlay').classList.add('hidden');
    nomeInput.value = '';
    telInput.value = '';
    if (ruaInput) ruaInput.value = '';
    if (bairroInput) bairroInput.value = '';
    if (numeroInput) numeroInput.value = '';
    if (refInput) refInput.value = '';
  }

  btn.innerHTML = originalText;
  btn.disabled = false;
}
