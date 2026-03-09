import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CreditCard, QrCode, FileText, Copy, CheckCircle2, Loader2 } from "lucide-react";

interface CheckoutDialogProps {
  planId: string;
  planName: string;
  planPrice: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PixResult {
  pixQrCode: string;
  pixCode: string;
  paymentId: string;
}

interface BoletoResult {
  bankSlipUrl: string;
  paymentId: string;
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function CheckoutDialog({
  planId,
  planName,
  planPrice,
  open,
  onOpenChange,
}: CheckoutDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("card");

  // Card fields
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");

  // PIX / Boleto results
  const [pixResult, setPixResult] = useState<PixResult | null>(null);
  const [boletoResult, setBoletoResult] = useState<BoletoResult | null>(null);
  const [copied, setCopied] = useState(false);

  const resetState = () => {
    setLoading(false);
    setPixResult(null);
    setBoletoResult(null);
    setCopied(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  async function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = cardNumber.replace(/\D/g, "");
    const cpfDigits = cpfCnpj.replace(/\D/g, "");
    const phoneDigits = phone.replace(/\D/g, "");
    const cepDigits = postalCode.replace(/\D/g, "");

    if (digits.length < 13) return toast.error("Número do cartão inválido");
    if (!expiry.includes("/") || expiry.length < 5) return toast.error("Validade inválida (MM/AA)");
    if (cvv.length < 3) return toast.error("CVV inválido");
    if (cpfDigits.length < 11) return toast.error("CPF/CNPJ inválido");
    if (!holderName.trim()) return toast.error("Nome do titular obrigatório");
    if (!email.includes("@")) return toast.error("E-mail inválido");
    if (phoneDigits.length < 10) return toast.error("Telefone inválido");
    if (cepDigits.length < 8) return toast.error("CEP inválido");

    const [expiryMonth, expiryYear] = expiry.split("/");

    setLoading(true);
    try {
      const data = await apiFetch<any>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          planId,
          billingType: "CREDIT_CARD",
          creditCard: {
            holderName,
            number: digits,
            expiryMonth,
            expiryYear: `20${expiryYear}`,
            ccv: cvv,
          },
          creditCardHolderInfo: {
            name: holderName,
            cpfCnpj: cpfDigits,
            email,
            phone: phoneDigits,
            postalCode: cepDigits,
            addressNumber,
          },
        }),
      });

      toast.success("Pagamento aprovado! Bem-vindo ao ReConnect.");
      handleOpenChange(false);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar pagamento";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handlePixGenerate() {
    setLoading(true);
    try {
      const data = await apiFetch<any>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId, billingType: "PIX" }),
      });

      setPixResult({
        pixQrCode: data.pixQrCode,
        pixCode: data.pixCode,
        paymentId: data.paymentId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PIX";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleBoletoGenerate() {
    setLoading(true);
    try {
      const data = await apiFetch<any>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId, billingType: "BOLETO" }),
      });

      setBoletoResult({
        bankSlipUrl: data.bankSlipUrl,
        paymentId: data.paymentId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar boleto";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar {planName}</DialogTitle>
          <DialogDescription>
            {planPrice}/mês — Escolha a forma de pagamento
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); resetState(); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="card" className="gap-1.5 text-xs sm:text-sm">
              <CreditCard className="h-3.5 w-3.5" /> Cartão
            </TabsTrigger>
            <TabsTrigger value="pix" className="gap-1.5 text-xs sm:text-sm">
              <QrCode className="h-3.5 w-3.5" /> PIX
            </TabsTrigger>
            <TabsTrigger value="boleto" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5" /> Boleto
            </TabsTrigger>
          </TabsList>

          {/* CARTÃO */}
          <TabsContent value="card">
            <form onSubmit={handleCardSubmit} className="space-y-3 pt-2">
              <div>
                <Label htmlFor="holderName">Nome no cartão</Label>
                <Input
                  id="holderName"
                  placeholder="Como está no cartão"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cardNumber">Número do cartão</Label>
                <Input
                  id="cardNumber"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="expiry">Validade</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/AA"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="000"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                <Input
                  id="cpfCnpj"
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                  maxLength={18}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-0000"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={15}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="postalCode">CEP</Label>
                  <Input
                    id="postalCode"
                    placeholder="00000-000"
                    value={postalCode}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setPostalCode(d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d);
                    }}
                    maxLength={9}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="addressNumber">Número</Label>
                  <Input
                    id="addressNumber"
                    placeholder="123"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                ) : (
                  <>Pagar {planPrice}</>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* PIX */}
          <TabsContent value="pix">
            <div className="space-y-4 pt-2">
              {!pixResult ? (
                <div className="text-center">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Gere um QR Code PIX para pagar instantaneamente.
                    Após a confirmação, seu plano será ativado automaticamente.
                  </p>
                  <Button onClick={handlePixGenerate} className="w-full" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PIX...</>
                    ) : (
                      <>Gerar QR Code PIX</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <img
                    src={`data:image/png;base64,${pixResult.pixQrCode}`}
                    alt="QR Code PIX"
                    className="mx-auto h-48 w-48 rounded-lg border"
                  />
                  <div>
                    <Label className="text-xs text-muted-foreground">Código copia e cola</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={pixResult.pixCode}
                        readOnly
                        className="text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(pixResult.pixCode)}
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Após o pagamento, seu plano será ativado automaticamente em alguns segundos.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* BOLETO */}
          <TabsContent value="boleto">
            <div className="space-y-4 pt-2">
              {!boletoResult ? (
                <div className="text-center">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Gere um boleto bancário. A compensação pode levar até 2 dias úteis.
                    Após a confirmação, seu plano será ativado automaticamente.
                  </p>
                  <Button onClick={handleBoletoGenerate} className="w-full" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando boleto...</>
                    ) : (
                      <>Gerar Boleto</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                  <p className="text-sm font-medium">Boleto gerado com sucesso!</p>
                  <div className="flex flex-col gap-2">
                    <Button asChild className="w-full">
                      <a href={boletoResult.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                        Abrir Boleto
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => copyToClipboard(boletoResult.bankSlipUrl)}
                    >
                      {copied ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Copiado!</>
                      ) : (
                        <><Copy className="mr-2 h-4 w-4" /> Copiar link do boleto</>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compensação em até 2 dias úteis. Seu plano será ativado automaticamente.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
