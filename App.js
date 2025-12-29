import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Modal,
  ActivityIndicator
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE ================= */
const SUPABASE_URL = "https://ufdxajghbphxburxazmj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4tW8NxX6X93chYuAxUNoeg_FFIqWLyJ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ================= EDGE FUNCTION ================= */
const EDGE_FUNCTION_URL =
  "https://ufdxajghbphxburxazmj.supabase.co/functions/v1/reflect-ai";

/* ================= APP ================= */
export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentEntry, setCurrentEntry] = useState("");
  const [selectedBg, setSelectedBg] = useState("bg1");

  const [aiResponse, setAiResponse] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const backgrounds = {
    bg1: { uri: "https://images.unsplash.com/photo-1506318123035-45a00ca23318" },
    bg2: { uri: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e" },
    bg3: { uri: "https://images.unsplash.com/photo-1519681393784-d120267933ba" },
    bg4: { uri: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee" }
  };

  const getLocalDate = () =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

  /* ========= SESSÃO ========= */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setCurrentEntry("");
        setSelectedBg("bg1");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  /* ========= CARREGAR DADOS ========= */
  useEffect(() => {
    if (!session) return;

    const loadData = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_bg")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile?.selected_bg) setSelectedBg(profile.selected_bg);

      const { data: entry } = await supabase
        .from("diary_entries")
        .select("content")
        .eq("user_id", session.user.id)
        .eq("entry_date", getLocalDate())
        .maybeSingle();

      setCurrentEntry(entry?.content || "");
    };

    loadData();
  }, [session]);

  /* ========= LOGIN ========= */
  const handleAuth = async () => {
    setLoading(true);
    setStatusMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) setStatusMessage("Email ou senha inválidos");

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  /* ========= SALVAR (INSERT ou UPDATE CORRETO) ========= */
  const saveEntry = async () => {
    setLoading(true);
    setStatusMessage("");

    const today = getLocalDate();

    const { data: existing } = await supabase
      .from("diary_entries")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("entry_date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("diary_entries")
        .update({
          content: currentEntry,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("diary_entries").insert({
        user_id: session.user.id,
        entry_date: today,
        content: currentEntry
      });
    }

    setStatusMessage("Diário salvo com sucesso");
    setLoading(false);
  };

  /* ========= IA ========= */
  const reflectWithIA = async () => {
    if (!currentEntry.trim()) {
      setAiResponse("Escreva algo antes de pedir a reflexão.");
      setShowAiModal(true);
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ prompt: currentEntry })
      });

      const data = await resp.json();
      setAiResponse(data?.text || "Não consegui gerar resposta.");
    } catch {
      setAiResponse("Erro ao consultar a IA.");
    }

    setShowAiModal(true);
    setLoading(false);
  };

  /* ========= HISTÓRICO ========= */
  const loadHistory = async () => {
    const { data } = await supabase
      .from("diary_entries")
      .select("*")
      .eq("user_id", session.user.id)
      .order("entry_date", { ascending: false });

    setHistory(data || []);
    setShowHistory(true);
  };

  /* ================= LOGIN ================= */
  if (!session) {
    return (
      <LinearGradient colors={["#0f172a", "#1e293b"]} style={styles.fullScreen}>
        <View style={styles.centered}>
          <View style={styles.glassCard}>
            <Text style={styles.loginTitle}>Diário IA</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.mainBtn} onPress={handleAuth}>
              <Text style={styles.btnText}>ENTRAR</Text>
            </TouchableOpacity>

            {statusMessage ? (
              <Text style={styles.errorText}>{statusMessage}</Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    );
  }

  /* ================= DIÁRIO ================= */
  return (
    <ImageBackground source={backgrounds[selectedBg]} style={styles.fullScreen}>
      <LinearGradient colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.4)"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 15, paddingTop: 40 }}>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString("pt-BR")}
          </Text>

          <TextInput
            multiline
            style={styles.textArea}
            value={currentEntry}
            onChangeText={setCurrentEntry}
            placeholder="Como você está hoje?"
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.buttonGrid}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#38bdf8" }]} onPress={reflectWithIA}>
              <Text style={styles.btnText}>IA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, { backgroundColor: "#22c55e" }]} onPress={saveEntry}>
              <Text style={styles.btnText}>SALVAR</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, { backgroundColor: "#eab308" }]} onPress={loadHistory}>
              <Text style={styles.btnText}>HIST.</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, { backgroundColor: "#ef4444" }]} onPress={handleLogout}>
              <Text style={styles.btnText}>SAIR</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator color="#fff" style={{ marginTop: 10 }} />}
          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        </ScrollView>
      </LinearGradient>

      {/* ===== MODAL IA ===== */}
      <Modal visible={showAiModal} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.aiContent}>
            <Text style={styles.aiTitle}>Reflexão IA</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={styles.aiText}>{aiResponse}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAiModal(false)}>
              <Text style={styles.btnText}>VOLTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL HISTÓRICO ===== */}
      <Modal visible={showHistory} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.aiContent}>
            <ScrollView style={{ maxHeight: 400 }}>
              {history.map(h => (
                <View key={h.id} style={{ marginBottom: 15 }}>
                  <Text style={{ color: "#38bdf8" }}>{h.entry_date}</Text>
                  <Text style={styles.aiText}>{h.content}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowHistory(false)}>
              <Text style={styles.btnText}>VOLTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

/* ================= ESTILOS ================= */
const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", padding: 25 },
  glassCard: { padding: 30, borderRadius: 25, backgroundColor: "rgba(0,0,0,0.6)" },
  loginTitle: { fontSize: 26, color: "#fff", fontWeight: "bold", marginBottom: 25, textAlign: "center" },
  input: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 15, color: "#fff", marginBottom: 15 },
  mainBtn: { backgroundColor: "#6366f1", borderRadius: 12, height: 50, justifyContent: "center", alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 11 },
  errorText: { color: "#f87171", textAlign: "center", marginTop: 10 },
  dateText: { fontSize: 36, color: "#fff", textAlign: "center", marginBottom: 15 },
  textArea: { height: 320, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, padding: 20, color: "#fff", fontSize: 18 },
  buttonGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  btn: { width: "23%", height: 45, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  statusText: { color: "#4ade80", textAlign: "center", marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", padding: 25 },
  aiContent: { backgroundColor: "#1e293b", padding: 25, borderRadius: 25 },
  aiTitle: { fontSize: 20, color: "#38bdf8", marginBottom: 15 },
  aiText: { color: "#f1f5f9", fontSize: 16, lineHeight: 24 },
  closeBtn: { marginTop: 20, backgroundColor: "#334155", height: 45, borderRadius: 12, justifyContent: "center", alignItems: "center" }
});
