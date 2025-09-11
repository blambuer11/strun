import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, Plus, Send, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface Transaction {
  id: string;
  type: "earn" | "spend";
  description: string;
  amount: number;
  timestamp: string;
}

interface WalletProps {
  balance: number;
  transactions: Transaction[];
  onBuyXP?: () => void;
  onSendXP?: () => void;
}

export function Wallet({ balance, transactions, onBuyXP, onSendXP }: WalletProps) {
  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-lg mx-auto space-y-6">
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
            onClick={onBuyXP}
          >
            <Plus className="mr-2" />
            Buy XP
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-xl border-white/20 hover:bg-white/10"
            onClick={onSendXP}
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
                animate={{ opacity: 1, x: 0 }}
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
          </div>
        </div>
      </div>
    </div>
  );
}