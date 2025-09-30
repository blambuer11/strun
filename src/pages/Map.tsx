import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import RunMap from "@/components/RunMap";
import { toast } from "sonner";

const Map = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if authenticated
    const token = localStorage.getItem("strun_id_token");
    if (!token) {
      navigate("/auth");
    }
  }, [navigate]);

  return <RunMap />;
};

export default Map;