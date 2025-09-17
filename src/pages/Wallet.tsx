import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet as WalletComponent } from "@/components/Wallet";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/zklogin";

const WalletPage = () => {
  const navigate = useNavigate();
  
  const [balance] = useState(1240);
  const [transactions] = useState([
    {
      id: "1",
      type: "earn" as const,
      description: "Bölge Ele Geçirildi",
      amount: 150,
      timestamp: "2 saat önce"
    },
    {
      id: "2",
      type: "spend" as const,
      description: "Kira Ödendi",
      amount: 50,
      timestamp: "Dün"
    },
    {
      id: "3",
      type: "earn" as const,
      description: "Günlük Ödül",
      amount: 25,
      timestamp: "Dün"
    },
    {
      id: "4",
      type: "earn" as const,
      description: "Bölge Kirası",
      amount: 75,
      timestamp: "2 gün önce"
    }
  ]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth");
    }
  }, [navigate]);

  const handleBuyXP = () => {
    toast.info("XP satın alma yakında geliyor!");
  };

  const handleSendXP = () => {
    toast.info("XP transferi yakında geliyor!");
  };

  return (
    <WalletComponent
      balance={balance}
      transactions={transactions}
      onBuyXP={handleBuyXP}
      onSendXP={handleSendXP}
    />
  );
};

export default WalletPage;