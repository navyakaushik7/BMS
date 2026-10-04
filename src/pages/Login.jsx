import { useState, useRef, useEffect } from 'react';
import { Phone, Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LEN = 6;

// Short, plain error words only
const short = (err, fallback) => {
  const s = err?.response?.status;
  if (s === 429) return 'Too many tries';
  if (s === 400) return fallback;
  return 'Failed';
};

export default function Login() {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState(Array(LEN).fill(''));
  const [devOtp, setDevOtp] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef([]);

  useEffect(() => { if (step === 'otp') boxes.current[0]?.focus(); }, [step]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e) => {
    e?.preventDefault();
    if (phone.length < 10) return setError('Invalid number');
    setError(''); setBusy(true);
    try {
      const data = await requestOtp(phone);
      setDevOtp(data.dev_otp || null);
      setDigits(Array(LEN).fill(''));
      setStep('otp'); setCooldown(30);
    } catch (err) { setError(short(err, 'Invalid number')); }
    finally { setBusy(false); }
  };

  const verify = async (code = digits.join('')) => {
    if (code.length < LEN) return setError('Enter OTP');
    setError(''); setBusy(true);
    try { await verifyOtp(phone, code); }
    catch (err) {
      setError(short(err, 'Wrong OTP'));
      setDigits(Array(LEN).fill(''));
      boxes.current[0]?.focus();
    } finally { setBusy(false); }
  };

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, '');
    if (!d) return;
    const next = [...digits];
    // typing or pasting: spread across boxes from position i
    d.slice(0, LEN - i).split('').forEach((ch, k) => { next[i + k] = ch; });
    setDigits(next);
    const last = Math.min(i + d.length, LEN - 1);
    boxes.current[last]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };

  const onKey = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) next[i] = ''; else if (i > 0) { next[i - 1] = ''; boxes.current[i - 1]?.focus(); }
      setDigits(next);
    } else if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < LEN - 1) boxes.current[i + 1]?.focus();
    else if (e.key === 'Enter') verify();
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError(''); setBusy(true);
    try { const d = await requestOtp(phone); setDevOtp(d.dev_otp || null); setCooldown(30); }
    catch (err) { setError(short(err, 'Failed')); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8F6F2] font-body">
      {/* Left brand panel */}
      <div className="relative overflow-hidden bg-[#213543] lg:w-[45%] px-8 py-10 lg:px-16 lg:py-0 flex flex-col justify-center min-h-[200px] lg:min-h-screen">
        <div className="pointer-events-none absolute -right-40 top-1/4 w-[520px] h-[520px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 top-[30%] w-[380px] h-[380px] rounded-full border border-white/10" />
        <p className="relative font-mono text-xs tracking-[0.3em] text-[#E8B85C] mb-6">BMS</p>
        <h1 className="relative font-body font-bold tracking-tight leading-[0.95] text-5xl sm:text-6xl lg:text-7xl text-[#F3EEE6]">
          Booth<br /><span className="text-[#E8B85C]">Management</span>
        </h1>
        <p className="hidden lg:block absolute bottom-8 left-16 font-mono text-[11px] tracking-[0.25em] text-white/30">PRE-POLL</p>
      </div>

      {/* Right login card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs tracking-[0.3em] text-[#3F7F6E] mb-3">{step === 'phone' ? 'LOGIN' : 'OTP'}</p>
          <h2 className="font-body font-bold tracking-tight text-4xl text-[#16283F] mb-8">
            {step === 'phone' ? 'Login' : 'Verify'}
          </h2>

          <div className="bg-white rounded-3xl border border-black/10 shadow-[0_10px_40px_rgba(15,27,46,0.08)] p-7">
            {step === 'phone' ? (
              <form onSubmit={send}>
                <label htmlFor="phone" className="block text-sm font-semibold text-[#16283F] mb-3">Mobile number</label>
                <div className="flex rounded-xl border border-black/15 bg-[#F8F6F2] overflow-hidden focus-within:border-[#4A8A7B] focus-within:ring-2 focus-within:ring-[#4A8A7B]/25">
                  <span className="px-4 shrink-0 flex items-center text-sm text-[#16283F] border-r border-black/10">+91</span>
                  <input
                    id="phone" type="tel" inputMode="numeric" autoFocus autoComplete="tel-national"
                    placeholder="98765 43210" value={phone} maxLength={10}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 bg-transparent px-4 py-3.5 text-lg text-[#16283F] placeholder:text-slate-400 outline-none"
                  />
                </div>
                {error && <p role="alert" className="text-sm text-[#B23A34] mt-3">{error}</p>}
                <button type="submit" disabled={busy}
                  className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#4A8A7B] hover:bg-[#3F7F6E] text-white text-lg py-3.5 transition-colors disabled:opacity-60">
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                  Send OTP {!busy && <ArrowRight className="w-5 h-5" />}
                </button>
              </form>
            ) : (
              <div>
                <div className="flex justify-between gap-2" onPaste={(e) => { e.preventDefault(); setDigit(0, e.clipboardData.getData('text')); }}>
                  {digits.map((d, i) => (
                    <input
                      key={i} ref={(el) => (boxes.current[i] = el)}
                      value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Digit ${i + 1}`} maxLength={LEN}
                      onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)}
                      onFocus={(e) => e.target.select()}
                      className="w-full aspect-square max-w-[52px] text-center text-2xl font-semibold text-[#16283F] rounded-xl border border-black/15 bg-[#F8F6F2] outline-none focus:border-[#4A8A7B] focus:ring-2 focus:ring-[#4A8A7B]/30"
                    />
                  ))}
                </div>
                {devOtp && (
                  <p className="mt-4 rounded-xl border border-[#E8B85C]/50 bg-[#FDF7E9] px-4 py-3 text-sm text-[#16283F]">
                    <b>Dev only:</b> OTP {devOtp}
                  </p>
                )}
                {error && <p role="alert" className="text-sm text-[#B23A34] mt-3">{error}</p>}
                <button onClick={() => verify()} disabled={busy}
                  className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#4A8A7B] hover:bg-[#3F7F6E] text-white text-lg py-3.5 transition-colors disabled:opacity-60">
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />} Login
                </button>
                <div className="flex justify-between mt-5 text-sm">
                  <button onClick={() => { setStep('phone'); setError(''); }} className="text-[#3F7F6E] hover:underline">Change number</button>
                  <button onClick={resend} disabled={cooldown > 0 || busy} className="text-[#3F7F6E] disabled:text-slate-400 hover:underline disabled:no-underline">
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="flex items-center justify-center gap-2 mt-6 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4" /> Secure
          </p>
        </div>
      </div>
    </div>
  );
}
