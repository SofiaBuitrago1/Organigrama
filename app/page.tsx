"use client";

import React, { useEffect, useState, useRef } from "react";

const obtenerColorPorNivel = (nivel: number) => {
  switch (nivel) {
    case 0: return "#FFD700"; // Dorado - Jefe máximo
    case 1: return "#FFEB3B"; // Amarillo - Jefes intermedios
    case 2: return "#FFB74D"; // Naranja vibrante - Subordinados
    case 3: return "#FF9800"; // Naranja fuerte - Nivel inferior
    default: return "#F5F5F5"; // Neutro
  }
};

const obtenerEstiloConBorde = (nivel: number) => {
  const baseStyle: React.CSSProperties = {
    background: obtenerColorPorNivel(nivel),
    padding: "8px 12px",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease",
    minWidth: "280px",
    maxWidth: "380px",                 // ✅ corregido (antes "380x")
    textAlign: "center",
    marginBottom: "8px",
    fontSize: "14px",
    whiteSpace: "normal",
    wordBreak: "break-word",
    fontFamily: "Arial, sans-serif",
  };

  if (nivel === 0) return { ...baseStyle, border: "3px solid #000" };
  if (nivel === 1) return { ...baseStyle, border: "2px solid #333" };
  return baseStyle;
};

interface Empleado {
  codigo: string;
  nombre: string;
  cargo: string;
  linea: string;
  codigoJefe: string;
  salario: number;
}

interface Nodo {
  id: string;
  nombre: string;
  hijos: Nodo[];
  salario: number;
  totalSubordinados: number;
  nivel: number;
}

/* ====== Estilos para UNA SOLA FILA (con auto-escala) ====== */
const filaOuter: React.CSSProperties = {
  width: "100%",
  overflowX: "hidden",        // no scroll: siempre entra por escala
};

const filaInnerBase: React.CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",         // ❗ sin saltos
  justifyContent: "center",
  gap: "16px",
  padding: "10px",
  width: "max-content",       // su ancho = suma de hijos
};

const columnaLinea: React.CSSProperties = {
  flex: "0 0 auto",
  minWidth: 320,
  maxWidth: 420,
};

export default function Organigrama() {
  const [data, setData] = useState<Empleado[]>([]);
  const [estructura, setEstructura] = useState<Nodo | null>(null);
  const [expandido, setExpandido] = useState<{ [key: string]: boolean }>({});
  const filaRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // === Carga de datos ===
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vReVbk3OMwom3zkwI7_qjd7IxuetkyWEONJE1P0UjuhRqrfGgIMWnlMlu4vOge4AxbQww1hvhqItFT-/pub?gid=1171697263&single=true&output=csv"
      )
        .then((response) => response.text())
        .then((csv) => {
          const lines = csv.split("\n").filter((line) => line.trim() !== "");
          const headers = lines[0].split(",").map((h) => h.trim());
          const empleados = lines.slice(1).map((line) => {
            const values = line.split(",");
            const row: any = {};
            headers.forEach((header, i) => { row[header] = values[i]?.trim(); });

            const salario = parseFloat(
              (row["salario"] || "0").replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(",", ".")
            );

            return {
              codigo: row["codigo"],
              nombre: row["nombre"],
              cargo: row["cargo"],
              linea: row["linea"] || "Sin línea",
              codigoJefe: row["codigoJefe"] || "",
              salario: isNaN(salario) ? 0 : salario,
            } as Empleado;
          });

          setData(empleados);
        });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // === Construcción de jerarquía ===
  useEffect(() => {
    if (data.length === 0) return;

    const empleadosPorCodigo = Object.fromEntries(data.map((e) => [e.codigo, e]));

    const construirJerarquiaPorLinea = (
      jefeId: string,
      linea: string,
      visitados = new Set<string>(),
      nivel = 0
    ): Nodo => {
      const claveUnica = `${jefeId}-${linea}`;
      if (visitados.has(claveUnica)) {
        return { id: claveUnica, nombre: `⚠ Ciclo detectado (${jefeId})`, hijos: [], salario: 0, totalSubordinados: 0, nivel };
      }

      visitados.add(claveUnica);
      const subordinados = data.filter((e) => e.codigoJefe === jefeId && e.linea === linea);
      const hijos: Nodo[] = subordinados.map((sub) =>
        construirJerarquiaPorLinea(sub.codigo, linea, new Set(visitados), nivel + 1)
      );

      const jefe = empleadosPorCodigo[jefeId];
      if (!jefe) {
        return { id: claveUnica, nombre: `⚠ Jefe no encontrado (${jefeId})`, hijos: [], salario: 0, totalSubordinados: 0, nivel };
      }

      return {
        id: claveUnica,
        nombre: `${jefe.cargo} – ${jefe.nombre}`,
        hijos,
        salario: jefe.salario,
        totalSubordinados: subordinados.length,
        nivel,
      };
    };

    const agruparPorLinea = (linea: string): Nodo => {
      const empleadosLinea = data.filter((e) => e.linea === linea);
      const codigosLinea = new Set(empleadosLinea.map((e) => e.codigo));
      const empleadosRaiz = empleadosLinea.filter((e) => !e.codigoJefe || !codigosLinea.has(e.codigoJefe));

      const empleadosPorCargo = empleadosRaiz.reduce((acc, e) => {
        if (!acc[e.cargo]) acc[e.cargo] = [];
        acc[e.cargo].push(e);
        return acc;
      }, {} as Record<string, Empleado[]>);

      const hijosAgrupados = Object.entries(empleadosPorCargo).map(([cargo, grupo]) => {
        const hijos = grupo.map((emp) => construirJerarquiaPorLinea(emp.codigo, linea, new Set(), 1));
        return {
          id: `${linea}-${cargo}`,
          nombre: `${cargo} (${grupo.length})`,
          hijos,
          salario: grupo.reduce((acc, e) => acc + e.salario, 0),
          totalSubordinados: grupo.length,
          nivel: 1,
        };
      });

      hijosAgrupados.sort((a, b) => b.salario - a.salario);

      return {
        id: linea,
        nombre: `${linea.toUpperCase()} (${empleadosLinea.length} colaboradores)`,
        hijos: hijosAgrupados,
        salario: empleadosLinea.reduce((acc, e) => acc + e.salario, 0),
        totalSubordinados: empleadosLinea.length,
        nivel: 0,
      };
    };

    const lineasUnicas = Array.from(new Set(data.map((e) => e.linea))).filter((linea) => linea !== "Sin línea");

    const hijosPorLinea = lineasUnicas
      .map((linea) => agruparPorLinea(linea))
      .filter((nodo) => nodo.totalSubordinados > 0 && nodo.salario > 0)
      .sort((a, b) => b.salario - a.salario);

    const empleadosConLinea = data.filter((e) => e.linea && e.linea !== "Sin línea");

    const nodoRaiz: Nodo = {
      id: "quick",
      nombre: `QUICK (${empleadosConLinea.length} colaboradores)`,
      hijos: hijosPorLinea,
      salario: empleadosConLinea.reduce((acc, e) => acc + e.salario, 0),
      totalSubordinados: empleadosConLinea.length,
      nivel: 0,
    };

    setEstructura(nodoRaiz);
  }, [data]);

  // === Auto-escala: asegura UNA SOLA FILA visible sin saltos ===
  const recalcularEscala = () => {
    if (!filaRef.current) return;
    const outer = filaRef.current.parentElement as HTMLElement;
    if (!outer) return;

    // Restablece escala a 1 para medir en "tamaño real"
    filaRef.current.style.transform = "scale(1)";
    const contentWidth = filaRef.current.scrollWidth;       // ancho real de todas las cajas
    const available = outer.clientWidth - 8;                // ancho disponible (con pequeño margen)
    const next = Math.min(1, available / contentWidth);     // 0..1
    setScale(next);
    // aplica inmediatamente para evitar "parpadeo"
    filaRef.current.style.transform = `scale(${next})`;
  };

  useEffect(() => {
    recalcularEscala();
    window.addEventListener("resize", recalcularEscala);
    return () => window.removeEventListener("resize", recalcularEscala);
    // Recalcula también cuando cambian expansiones (puede variar el ancho)
  }, [estructura, expandido]);

  const toggle = (id: string) => setExpandido((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderNodoExpandido = (nodo: Nodo) => (
    <div
      key={nodo.id}
      style={{ marginLeft: nodo.nivel * 10, marginBottom: 4, transition: "all 0.3s ease" }}
    >
      <div onClick={() => toggle(nodo.id)} style={obtenerEstiloConBorde(nodo.nivel)}>
        {nodo.nombre.split("–")[1]?.trim()}
        <br />${nodo.salario.toLocaleString("es-CO")}
        <br />
        {nodo.totalSubordinados} colaboradores
      </div>
      {expandido[nodo.id] && nodo.hijos.map((h) => renderNodoExpandido(h))}
    </div>
  );

  const iconoPorCargo = (cargo: string) => {
    if (cargo.includes("COORDINADOR")) return "📦";
    if (cargo.includes("LIDER")) return "🧠";
    if (cargo.includes("SUPERVISOR")) return "👷";
    if (cargo.includes("JEFE")) return "🧑‍💼";
    return "🔹";
  };

  const renderVisualOrganigrama = (estructura: Nodo) => (
    <div style={{ paddingBottom: 20 }}>
      {/* Tarjeta superior QUICK */}
      <div
        style={{
          background: "#000000",
          color: "#FFD700",
          padding: "16px",
          borderRadius: "16px",
          fontWeight: "bold",
          fontSize: "20px",
          boxShadow: "0 4px 12px rgba(255, 215, 0, 0.3)",
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
          marginBottom: "20px",
          maxWidth: "400px",
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: "28px", letterSpacing: "1px" }}>QUICK</div>
        <div style={{ marginTop: "8px", fontSize: "16px" }}>
          👥 Total QUICK: {estructura.totalSubordinados} colaboradores
          <br />
          💰 Salario total: ${estructura.salario.toLocaleString("es-CO")}
        </div>
      </div>

      {/* Fila única de líneas (auto-escala) */}
      <div style={filaOuter}>
        <div
          ref={filaRef}
          style={{
            ...filaInnerBase,
            transform: `scale(${scale})`,
            transformOrigin: "top left", 
          }}
        >
          {estructura.hijos.map((lineaNodo) => (
            <div key={lineaNodo.id} style={columnaLinea}>
              <h3
                onClick={() => toggle(lineaNodo.id)}
                style={{
                  marginBottom: 10,
                  cursor: "pointer",
                  background: "#000000",
                  color: "#FFD700",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  boxShadow: "0 4px 8px rgba(255, 215, 0, 0.2)",
                  fontWeight: "bold",
                  fontFamily: "Arial, sans-serif",
                  fontSize: "16px",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {lineaNodo.nombre} – ${lineaNodo.salario.toLocaleString("es-CO")}
              </h3>

              {expandido[lineaNodo.id] &&
                lineaNodo.hijos.map((cargoNodo) => (
                  <div key={cargoNodo.id} style={{ marginBottom: 10 }}>
                    <div
                      onClick={() => toggle(cargoNodo.id)}
                      style={{
                        background: obtenerColorPorNivel(cargoNodo.nivel),
                        color: "#000000",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                        fontWeight: "bold",
                        cursor: "pointer",
                        fontFamily: "Arial, sans-serif",
                        textAlign: "center",
                      }}
                    >
                      {iconoPorCargo(cargoNodo.nombre)} {cargoNodo.nombre} – $
                      {cargoNodo.salario.toLocaleString("es-CO")}
                    </div>
                    {expandido[cargoNodo.id] && (
                      <div style={{ marginLeft: 10, marginTop: 4 }}>
                        {cargoNodo.hijos.map((hijo) => renderNodoExpandido(hijo))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Reset mínimo para consistencia local/prod */}
      <style jsx global>{`
        * { box-sizing: border-box; }
        html { font-size: 16px; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        body { margin: 0; }
      `}</style>
    </div>
  );

  return estructura ? renderVisualOrganigrama(estructura) : <div>Cargando datos...</div>;
}






   