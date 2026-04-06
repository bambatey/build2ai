import { defineStore } from 'pinia'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  diff?: {
    oldValue: string
    newValue: string
    lineNumber: number
  }[]
  isLoading?: boolean
}

export interface QuickCommand {
  id: string
  label: string
  prompt: string
  icon?: string
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: Date
  lastActive: Date
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as ChatMessage[],
    isLoading: false,
    model: 'claude-opus-4-6' as string,
    quickCommands: [
      {
        id: '1',
        label: 'Yükleri kontrol et',
        prompt: 'Bu modeldeki tüm yük durumlarını ve kombinasyonlarını kontrol et. TBDY 2018\'e uyumlu mu?',
        icon: 'weight',
      },
      {
        id: '2',
        label: 'Kesitleri optimize et',
        prompt: 'Kapasite oranlarına bakarak kesitleri optimize et. Hangi elemanlar küçültülebilir veya büyütülmeli?',
        icon: 'zap',
      },
      {
        id: '3',
        label: 'Deprem analizi yap',
        prompt: 'Deprem yüklerini analiz et. DD-2 için SDS ve SD1 değerlerini kontrol et.',
        icon: 'activity',
      },
      {
        id: '4',
        label: 'TBDY 2018 uyumu',
        prompt: 'Bu modeli TBDY 2018 yönetmeliğine göre kontrol et. Eksik veya hatalı parametreler var mı?',
        icon: 'check-circle',
      },
      {
        id: '5',
        label: 'Model özeti çıkar',
        prompt: 'Bu modelin detaylı özetini çıkar: düğüm sayısı, eleman sayısı, malzemeler, yükler, vb.',
        icon: 'file-text',
      },
      {
        id: '6',
        label: 'Deplasman kontrolü',
        prompt: 'Göreli kat ötelemelerini kontrol et. TBDY 2018 sınır değerlerini aşan katlar var mı?',
        icon: 'move',
      },
      {
        id: '7',
        label: 'Malzeme özellikleri',
        prompt: 'Modelde kullanılan beton ve çelik malzemelerinin özelliklerini listele.',
        icon: 'package',
      },
      {
        id: '8',
        label: 'Kritik kesitler',
        prompt: 'En yüksek kapasite oranına sahip elemanları bul ve detaylarını göster.',
        icon: 'alert-triangle',
      },
    ] as QuickCommand[],
    sessions: [] as ChatSession[],
    currentSession: null as ChatSession | null,
  }),

  getters: {
    messageCount: (state) => state.messages.length,

    lastMessage: (state) => {
      return state.messages[state.messages.length - 1]
    },

    userMessages: (state) => {
      return state.messages.filter(m => m.role === 'user')
    },

    assistantMessages: (state) => {
      return state.messages.filter(m => m.role === 'assistant')
    },
  },

  actions: {
    async sendMessage(content: string) {
      // Kullanıcı mesajı ekle
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      this.messages.push(userMessage)

      // Loading state başlat
      this.isLoading = true

      // AI mesajı placeholder
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      }
      this.messages.push(aiMessage)

      // Simüle edilmiş AI yanıtı (mock)
      await this.simulateAIResponse(aiMessage.id, content)
    },

    async simulateAIResponse(messageId: string, userPrompt: string) {
      // 1-2 saniye bekle (typing animasyonu için)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Mock AI yanıtı
      const responses = this.generateMockResponse(userPrompt)

      const messageIndex = this.messages.findIndex(m => m.id === messageId)
      if (messageIndex !== -1) {
        this.messages[messageIndex].content = responses.content
        this.messages[messageIndex].diff = responses.diff
        this.messages[messageIndex].isLoading = false
      }

      this.isLoading = false
    },

    generateMockResponse(prompt: string) {
      const lowerPrompt = prompt.toLowerCase()

      if (lowerPrompt.includes('yük') || lowerPrompt.includes('kontrol')) {
        return {
          content: `🔍 **Yük Kontrol Analizi**

Model yükleri analiz edildi:

**Yük Durumları:**
- DL (Sabit Yükler) ✓
- LL (Hareketli Yükler) ✓
- EQX (Deprem X) ⚠️
- EQY (Deprem Y) ⚠️
- WX (Rüzgar X) ✓
- WY (Rüzgar Y) ✓

**Yük Kombinasyonları:** 24 adet tanımlı

⚠️ **Tespit Edilen Sorunlar:**
1. Deprem yüklerinde TBDY 2018 parametreleri eksik
2. SDS ve SD1 değerleri tanımlanmamış
3. Bina Önem Katsayısı (I) belirtilmemiş

Düzeltmek ister misiniz?`,
          diff: undefined,
        }
      }

      if (lowerPrompt.includes('kesit') || lowerPrompt.includes('optimize')) {
        return {
          content: `⚡ **Kesit Optimizasyon Analizi**

Kapasite oranları kontrol edildi:

**Kritik Elemanlar (KO > 0.95):**
- Kolon C23: W14x90 → KO = 0.97 ⚠️
- Kolon C45: W14x90 → KO = 0.96 ⚠️
- Kiriş B12: W21x62 → KO = 0.98 ⚠️

**Optimize Edilebilir Elemanlar (KO < 0.70):**
- 12 kolon: W16x67 → W14x61 (tasarruf)
- 8 kiriş: W24x68 → W21x62 (tasarruf)

💡 **Öneri:** Kritik kolonları W14x90'dan W16x77'ye yükseltmenizi öneriyorum.`,
          diff: [
            {
              lineNumber: 847,
              oldValue: 'Frame=23   Section=W14x90',
              newValue: 'Frame=23   Section=W16x77',
            },
          ],
        }
      }

      if (lowerPrompt.includes('deprem') || lowerPrompt.includes('tbdy')) {
        return {
          content: `🌍 **TBDY 2018 Deprem Analizi**

**Mevcut Parametreler:**
- Deprem Yer Hareketi Düzeyi: Belirtilmemiş ⚠️
- SDS: Tanımlı değil ⚠️
- SD1: Tanımlı değil ⚠️
- Bina Önem Katsayısı: Belirtilmemiş ⚠️

**Önerilen Değerler (İstanbul - DD-2):**
- Deprem Yer Hareketi Düzeyi: DD-2
- Kısa periyot spektral ivme (SDS): 1.105
- 1 sn periyot spektral ivme (SD1): 0.462
- Bina Önem Katsayısı (I): 1.0
- Deprem Tasarım Sınıfı: DTS-1

Bu parametreleri uygulamak ister misiniz?`,
          diff: undefined,
        }
      }

      if (lowerPrompt.includes('özet') || lowerPrompt.includes('model')) {
        return {
          content: `📊 **Model Özet Raporu**

**Genel Bilgiler:**
├─ Program: SAP2000 v26
├─ Model Adı: Bina_Model_v3
└─ Son Güncellenme: ${new Date().toLocaleDateString('tr-TR')}

**Geometri:**
├─ Düğüm sayısı: 847
├─ Çerçeve eleman: 1,203
├─ Kabuk eleman: 342
└─ Kat sayısı: 12

**Malzemeler:**
├─ Beton: C30/37
├─ Çelik: S420, S275JR
└─ Donatı: B420C

**Yüklemeler:**
├─ Yük durumları: 6 adet
├─ Yük kombinasyonları: 24 adet
└─ Deprem spektrumu: Tanımlı değil ⚠️

**Analiz Durumu:**
├─ Son analiz: 2 saat önce
└─ Durum: Başarılı ✓`,
          diff: undefined,
        }
      }

      // Varsayılan yanıt
      return {
        content: `Anladım. Bu konuda size yardımcı olabilirim.

Lütfen daha spesifik olur musunuz? Örneğin:
- Hangi elemanları değiştirmemi istersiniz?
- Hangi parametreleri kontrol etmemi istersiniz?
- Hangi yönetmeliğe göre kontrol yapayım?

Yardımcı olabileceğim konular:
✓ Yük tanımları ve kontrol
✓ Kesit optimizasyonu
✓ Deprem analizi (TBDY 2018)
✓ Model raporu oluşturma`,
        diff: undefined,
      }
    },

    clearMessages() {
      this.messages = []
    },

    removeMessage(id: string) {
      this.messages = this.messages.filter(m => m.id !== id)
    },

    setModel(model: string) {
      this.model = model
    },

    createNewSession(name: string) {
      const session: ChatSession = {
        id: crypto.randomUUID(),
        name,
        messages: [],
        createdAt: new Date(),
        lastActive: new Date(),
      }
      this.sessions.push(session)
      this.currentSession = session
      this.messages = []
    },

    loadSession(id: string) {
      const session = this.sessions.find(s => s.id === id)
      if (session) {
        this.currentSession = session
        this.messages = session.messages
      }
    },
  },
})
