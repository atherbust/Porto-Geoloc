import { supabase } from './lib/supabase';

const btnSend = document.getElementById('btn-send-location');
const btnVerify = document.getElementById('btn-verify-code');
const stepAuth = document.getElementById('step-auth');
const stepLocation = document.getElementById('step-location');
const loadingArea = document.getElementById('loading-area');
const successArea = document.getElementById('success-area');
const codeInputs = document.querySelectorAll('.code-input');

// Photo Upload Elements
const photoDropzone = document.getElementById('photo-dropzone');
const inputPhoto = document.getElementById('input-photo');
const photoPreview = document.getElementById('photo-preview');
const photoPlaceholder = document.getElementById('photo-placeholder');
const btnRemovePhoto = document.getElementById('btn-remove-photo');

let selectedPhoto = null;

// Get Delivery ID from URL (?id=...)
const urlParams = new URLSearchParams(window.location.search);
const deliveryId = urlParams.get('id');

if (!deliveryId) {
    console.error('Alerta: Link acessado sem ID de entrega.');
}

// Initial state for send button (Disabled until photo)
if (btnSend) {
    btnSend.disabled = true;
    btnSend.classList.add('opacity-50', 'grayscale-[0.5]');
}

// Photo Pick Logic
photoDropzone.addEventListener('click', () => inputPhoto.click());

inputPhoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedPhoto = file;
        const reader = new FileReader();
        reader.onload = (prev) => {
            photoPreview.src = prev.target.result;
            photoPreview.classList.remove('hidden');
            photoPlaceholder.classList.add('hidden');
            btnRemovePhoto.classList.remove('hidden');

            // Enable send button
            btnSend.disabled = false;
            btnSend.classList.remove('opacity-50', 'grayscale-[0.5]');
        };
        reader.readAsDataURL(file);
    }
});

btnRemovePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedPhoto = null;
    inputPhoto.value = '';
    photoPreview.src = '';
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');
    btnRemovePhoto.classList.add('hidden');

    // Disable send button
    btnSend.disabled = true;
    btnSend.classList.add('opacity-50', 'grayscale-[0.5]');
});

// ... (previous numeric input jumping logic) ...
codeInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && idx < codeInputs.length - 1) {
            codeInputs[idx + 1].focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
            codeInputs[idx - 1].focus();
        }
    });
});

// Global deliveryId can be updated if verified via code-only
let currentDeliveryId = deliveryId;

async function handleVerifyCode() {
    const code = Array.from(codeInputs).map(i => i.value).join('');

    if (code.length < 4) {
        alert('Por favor, insira o código completo de 4 dígitos.');
        return;
    }

    btnVerify.disabled = true;
    btnVerify.innerText = 'Validando...';

    try {
        let query = supabase.from('entregas').select('id, codigo_acesso');

        if (currentDeliveryId) {
            // If we have an ID from URL, verify specifically for it
            query = query.eq('id', currentDeliveryId).single();
        } else {
            // UNIVERSAL QR CODE LOGIC: Search by code among pending deliveries
            query = query.eq('codigo_acesso', code).eq('status', 'pendente').order('created_at', { ascending: false }).limit(1).maybeSingle();
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erro do Supabase:', error);
            throw new Error('Erro ao conectar com o servidor.');
        }

        if (!data) {
            const msg = currentDeliveryId
                ? 'Pedido não encontrado ou código inválido.'
                : 'Código não encontrado ou já localizado. Verifique com o vendedor.';
            throw new Error(msg);
        }

        // Logic check: if we came from Universal QR, the code entered must match (it will by query, but let's be safe)
        if (data.codigo_acesso === code) {
            // Important: Save the ID for the next steps (location/photo)
            currentDeliveryId = data.id;

            // Success: Switch Steps
            stepAuth.classList.add('hidden');
            stepLocation.classList.remove('hidden');
        } else {
            throw new Error('Código incorreto.');
        }
    } catch (err) {
        console.error('Erro na validação:', err);
        alert(err.message);
        btnVerify.disabled = false;
        btnVerify.innerText = 'Validar Código';
        codeInputs.forEach(i => i.value = '');
        codeInputs[0].focus();
    }
}

async function handleSendLocation() {
    if (!currentDeliveryId) {
        alert('Sessão inválida. Por favor, reinicie o processo.');
        return;
    }

    if (!navigator.geolocation) {
        alert('Seu navegador não suporta geolocalização.');
        return;
    }

    // Update Button State to Loading
    const originalContent = btnSend.innerHTML;
    btnSend.disabled = true;
    btnSend.innerHTML = `
        <div class="h-8 w-8 border-4 border-white/20 border-t-white rounded-full animate-spin mb-1"></div>
        <span class="text-xs font-black uppercase tracking-tight">Enviando...</span>
    `;

    // Show Loading Overlay
    loadingArea.classList.remove('hidden');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            try {
                let fotoUrl = null;

                // 1. Upload Photo if selected
                if (selectedPhoto) {
                    const fileExt = selectedPhoto.name.split('.').pop();
                    const fileName = `${currentDeliveryId}-${Date.now()}.${fileExt}`;
                    const filePath = `fotos/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('entregas-fotos')
                        .upload(filePath, selectedPhoto);

                    if (uploadError) throw new Error('Erro ao fazer upload da foto: ' + uploadError.message);

                    const { data: publicUrlData } = supabase.storage
                        .from('entregas-fotos')
                        .getPublicUrl(filePath);

                    fotoUrl = publicUrlData.publicUrl;
                }

                // 2. Update Location and Photo URL
                const { error } = await supabase
                    .from('entregas')
                    .update({
                        latitude,
                        longitude,
                        precisao_gps: accuracy,
                        status: 'localizado',
                        confirmado_pelo_cliente: true,
                        data_localizacao: new Date().toISOString(),
                        foto_url: fotoUrl
                    })
                    .eq('id', currentDeliveryId);

                if (error) throw error;

                // Success State
                loadingArea.classList.add('hidden');
                stepLocation.classList.add('hidden');
                successArea.classList.remove('hidden');

            } catch (err) {
                console.error('Erro detalhado:', err);
                alert('Erro ao enviar: ' + (err.message || 'Erro desconhecido'));
                btnSend.disabled = false;
                btnSend.innerHTML = originalContent;
                loadingArea.classList.add('hidden');
            }
        },
        (err) => {
            console.error('Erro de GPS:', err);
            let msg = 'Erro ao obter localização.';
            if (err.code === 1) msg = 'Por favor, autorize o acesso ao GPS nas configurações do seu navegador.';
            alert(msg);
            btnSend.disabled = false;
            btnSend.innerHTML = originalContent;
            loadingArea.classList.add('hidden');
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
}

if (btnVerify) {
    btnVerify.addEventListener('click', handleVerifyCode);
}

if (btnSend) {
    btnSend.addEventListener('click', handleSendLocation);
}
