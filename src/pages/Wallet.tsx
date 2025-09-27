import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, Plus, Send, TrendingUp, Copy, Check, Wallet as WalletIcon } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateWalletForUser } from "@/lib/auto-wallet";

interface Transaction {
  id: string;
  type: "earn" | "spend";
  description: string;
  amount: number;
  timestamp: string;
}

const WalletPage = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletCopied, setWalletCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get or create wallet
      const wallet = await getOrCreateWalletForUser(user.id);
      if (wallet) {
        setWalletAddress(wallet.address);
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, xp, wallet_address')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        setBalance(profile.xp || 0);
        if (!walletAddress && profile.wallet_address) {
          setWalletAddress(profile.wallet_address);
        }

        // Get XP transactions
        const { data: xpTransactions } = await supabase
          .from('xp_transactions')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (xpTransactions) {
          const formattedTransactions: Transaction[] = xpTransactions.map(tx => ({
            id: tx.id,
            type: tx.amount > 0 ? "earn" : "spend",
            description: tx.description || tx.type,
            amount: Math.abs(tx.amount),
            timestamp: new Date(tx.created_at).toLocaleDateString()
          }));
          setTransactions(formattedTransactions);
        }
      }
    } catch (error) {
      console.error("Error loading wallet data:", error);
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyXP = () => {
    toast.info("XP purchase coming soon!");
  };

  const handleSendXP = () => {
    toast.info("XP transfer coming soon!");
  };

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setWalletCopied(true);
      toast.success("Wallet address copied!");
      setTimeout(() => setWalletCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20 flex items-center justify-center">
        <div className="text-center">
          <WalletIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Wallet Address Card */}
        {walletAddress && (
          <Card className="p-4 bg-card/50 border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Wallet Address</p>
                <p className="font-mono text-sm">
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={copyWalletAddress}
              >
                {walletCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </Card>
        )}

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 bg-gradient-to-br from-primary to-accent text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-xs"></div>
            <div className="relative z-10 text-center space-y-2">
              <p className="text-sm opacity-90">Your Balance</p>
              <div className="text-5xl font-bold">{balance.toLocaleString()}</div>
              <div className="text-xl font-semibold">XP</div>
            </div>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="gradient"
            size="lg"
            className="rounded-xl"
            onClick={handleBuyXP}
          >
            <Plus className="mr-2" />
            Buy XP
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-xl border-white/20 hover:bg-white/10"
            onClick={handleSendXP}
          >
            <Send className="mr-2" />
            Send XP
          </Button>
        </div>

        {/* Transactions */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Recent Transactions
          </h3>
          <div className="space-y-2">
            {transactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-4 bg-card/50 border-white/10 backdrop-blur-sm hover:bg-card/70 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        transaction.type === "earn" 
                          ? "bg-accent/20 text-accent" 
                          : "bg-destructive/20 text-destructive"
                      }`}>
                        {transaction.type === "earn" ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">{transaction.timestamp}</p>
                      </div>
                    </div>
                    <div className={`font-bold ${
                      transaction.type === "earn" ? "text-accent" : "text-destructive"
                    }`}>
                      {transaction.type === "earn" ? "+" : "-"}{transaction.amount} XP
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
            
            {transactions.length === 0 && (
              <Card className="p-8 bg-card/50 border-white/10 backdrop-blur-sm text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="text-sm text-muted-foreground mt-1">Start running to earn XP!</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;