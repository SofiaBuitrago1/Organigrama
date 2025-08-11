"use client";

import React, { useEffect, useState } from "react";

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
    minWidth: "320px",
    maxWidth: "420px",
    textAlign: "center", // Se asegura de que sea 'center' | 'left' | 'right'
    marginBottom: "8px",
    fontSize: "14px",
    whiteSpace: "normal",
    wordBreak: "break-word", // Se asegura de que sea 'break-word' | 'normal' | 'keep-all'
    fontFamily: "Arial, sans-serif",
  };

  if (nivel === 0) {
    return { ...baseStyle, border: "3px solid #000" }; // Jefe máximo
  }
  if (nivel === 1) {
    return { ...baseStyle, border: "2px solid #333" }; // Jefes intermedios
  }

  return baseStyle; // Subordinados sin borde
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
  nivel: number; // Se agregó 'nivel' como propiedad
}

export default function Organigrama() {
  const [data, setData] = useState<Empleado[]>([]);
  const [estructura, setEstructura] = useState<Nodo | null>(null);
  const [expandido, setExpandido] = useState<{ [key: string]: boolean }>({});

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
          headers.forEach((header, i) => {
            row[header] = values[i]?.trim();
          });

          const salario = parseFloat(
            (row["salario"] || "0")
              .replace(/[^0-9.,-]/g, "")
              .replace(/\./g, "")
              .replace(",", ".")
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
      }, 30000); // Actualizar cada 30 segundos

  return () => clearInterval(interval); // Limpiar el intervalo cuando el componente se desmonte
  }, []);

  useEffect(() => {
    if (data.length === 0) return;

    const empleadosPorCodigo = Object.fromEntries(
      data.map((e) => [e.codigo, e])
    );

    const construirJerarquiaPorLinea = (
      jefeId: string,
      linea: string,
      visitados = new Set<string>(),
      nivel = 0 // 👈 nuevo parámetro
    ): Nodo => {
      const claveUnica = `${jefeId}-${linea}`;
      if (visitados.has(claveUnica)) {
        return {
          id: claveUnica,
          nombre: `⚠ Ciclo detectado (${jefeId})`,
          hijos: [],
          salario: 0,
          totalSubordinados: 0,
          nivel, // 👈 Aquí asignas el nivel
        };
      }

      visitados.add(claveUnica);

      const subordinados = data.filter(
        (e) => e.codigoJefe === jefeId && e.linea === linea
      );

      const hijos: Nodo[] = subordinados.map((sub) =>
        construirJerarquiaPorLinea(sub.codigo, linea, new Set(visitados), nivel + 1) // 👈 nivel + 1

      );

      const jefe = empleadosPorCodigo[jefeId];
      if (!jefe) {
        return {
          id: claveUnica,
          nombre: `⚠ Jefe no encontrado (${jefeId})`,
          hijos: [],
          salario: 0,
          totalSubordinados: 0,
          nivel, // 👈 Aquí también
        };
      }

      return {
        id: claveUnica,
        nombre: `${jefe.cargo} – ${jefe.nombre}`,
        hijos,
        salario: jefe.salario,
        totalSubordinados: subordinados.length,
        nivel, // 👈 nuevo campo
      };
    };

    const agruparPorLinea = (linea: string): Nodo => {
      const empleadosLinea = data.filter((e) => e.linea === linea);
      const codigosLinea = new Set(empleadosLinea.map((e) => e.codigo));

      const empleadosRaiz = empleadosLinea.filter(
        (e) => !e.codigoJefe || !codigosLinea.has(e.codigoJefe)
      );

      const empleadosPorCargo = empleadosRaiz.reduce((acc, e) => {
        if (!acc[e.cargo]) acc[e.cargo] = [];
        acc[e.cargo].push(e);
        return acc;
      }, {} as Record<string, Empleado[]>);

      const hijosAgrupados = Object.entries(empleadosPorCargo).map(
        ([cargo, grupo]) => {
          const hijos = grupo.map((emp) =>
            construirJerarquiaPorLinea(emp.codigo, linea, new Set(), 1) // Asegúrate de pasar `nivel)
          );

          return {
            id: `${linea}-${cargo}`,
            nombre: `${cargo} (${grupo.length})`,
            hijos,
            salario: grupo.reduce((acc, e) => acc + e.salario, 0),
            totalSubordinados: grupo.length,
            nivel: 1, // Asegúrate de asignar un valor para `nivel
          };
        }
      );

      // Ordenar los hijos por salario (de mayor a menor)
      hijosAgrupados.sort((a, b) => b.salario - a.salario);

      return {
        id: linea,
        nombre: `${linea.toUpperCase()} (${empleadosLinea.length} colaboradores)`,
        hijos: hijosAgrupados,
        salario: empleadosLinea.reduce((acc, e) => acc + e.salario, 0),
        totalSubordinados: empleadosLinea.length,
        nivel: 0, // Este es el nivel para el nodo raíz, normalmente 0
      };
    };

    const lineasUnicas = Array.from(
      new Set(data.map((e) => e.linea))
    ).filter((linea) => linea !== "Sin línea");

    const hijosPorLinea = lineasUnicas
      .map((linea) => agruparPorLinea(linea))
      .filter((nodo) => nodo.totalSubordinados > 0 && nodo.salario > 0);

    // Ordenar las líneas por salario total
    hijosPorLinea.sort((a, b) => b.salario - a.salario);

    const empleadosConLinea = data.filter(
      (e) => e.linea && e.linea !== "Sin línea"
    );

    const nodoRaiz: Nodo = {
      id: "quick",
      nombre: `QUICK (${empleadosConLinea.length} colaboradores)`,
      hijos: hijosPorLinea,
      salario: empleadosConLinea.reduce((acc, e) => acc + e.salario, 0),
      totalSubordinados: empleadosConLinea.length,
      nivel: 0, // Aquí también debes asignar el nivel para el nodo raíz
    };

    setEstructura(nodoRaiz);
  }, [data]);

  const toggle = (id: string) => {
    setExpandido((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTodo = (abrir: boolean) => {
    if (!estructura) return;
    const nuevos: { [key: string]: boolean } = {};
    estructura.hijos.forEach((linea) => {
      nuevos[linea.id] = abrir;
      linea.hijos.forEach((cargo) => {
        nuevos[cargo.id] = abrir;
      });
    });
    setExpandido(nuevos);
  };

  const renderNodoExpandido = (nodo: Nodo) => {
    const fondo = obtenerColorPorNivel(nodo.nivel);
    const estiloNodo = {
      background: fondo,
      padding: "0.5rem 0.75rem",  // Usa rem en lugar de px
      borderRadius: "0.5rem",  // Usa rem
      boxShadow: "0 4px 6px rgba(0,0,0,0.2)", // Sombra ligera para destacar
      color: "#000",  // Texto en negro
      fontWeight: "bold",
      cursor: "pointer",
      transition: "all 0.3s ease",
      minWidth: "320px",  // Ampliado el ancho mínimo de la caja
      maxWidth: "420x",  // Ampliado el ancho máximo
      textAlign: "center", // Centrado del texto
      marginBottom: "0.5rem",  // Usa rem
      fontSize: "1rem",  // Usa rem
      whiteSpace: "normal",
      wordBreak: "break-word",

    };

    return (
      <div
        key={nodo.id}
        style={{
          marginLeft: nodo.nivel * 10,
          marginBottom: 4,
          transition: "all 0.3s ease",
        }}
      >
        <div
          onClick={() => toggle(nodo.id)}
          style={obtenerEstiloConBorde(nodo.nivel)}
        >
          {nodo.nombre.split("–")[1]?.trim()} {/* Mostrar solo el nombre sin repetir el cargo */}
          <br />
          ${nodo.salario.toLocaleString("es-CO")}
          <br />
          {nodo.totalSubordinados} colaboradores
        </div>
        {expandido[nodo.id] &&
          nodo.hijos.map((h) => renderNodoExpandido(h))}
      </div>
    );
  };

  const colorPorLinea = (linea: string) => {
    const colores: Record<string, string> = {
      "FIRST MILE": "#FFEB3B", // Amarillo brillante
      "WAREHOUSE": "#FFC107",   // Amarillo oscuro
      "LAST MILE": "#FF9800",   // Naranja cálido
      "LONG HAUL": "#FF5722",   // Naranja fuerte
    };
    return colores[linea] || "#000000"; // Negro por defecto
  };

  const iconoPorCargo = (cargo: string) => {
    if (cargo.includes("COORDINADOR")) return "📦";
    if (cargo.includes("LIDER")) return "🧠";
    if (cargo.includes("SUPERVISOR")) return "👷";
    if (cargo.includes("JEFE")) return "🧑‍💼";
    return "🔹";
  };

  const contenedorPrincipal = {
    display: "flex",
    gap: "10px", // Reducir espacio entre las cajas
    flexWrap: "wrap", // Permite que las cajas se acomoden en varias filas si es necesario
    justifyContent: "space-evenly", // Espaciado igual entre las cajas
    padding: "10px", // Reducir padding
  };
  const botonEstilo = {
  background: "#000000",
  color: "#FFD700",
  border: "2px solid #FFD700",
  padding: "8px 12px",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
  margin: "4px",
  fontFamily: "Arial, sans-serif",
};

const renderNodoCompacto = (nodo: Nodo) => {
  const fondo = obtenerColorPorNivel(nodo.nivel);
  const estiloNodo = {
    background: fondo,
    color: "#000000",
    padding: "0.5rem 0.75rem",  // Usa rem en lugar de px
    borderRadius: "0.5rem",  // Usa rem
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontSize: "1rem",  // Usa rem
    fontFamily: "Arial, sans-serif",
    marginBottom: "0.5rem",  // Usa rem
    textAlign: "center" as "center" | "left" | "right",  // Corregido: especificamos los valores posibles
  };

  return (
    <div key={nodo.id} style={{ marginLeft: nodo.nivel * 10 }}>
      <div onClick={() => toggle(nodo.id)} style={estiloNodo}>
        {nodo.nombre.split("–")[1]?.trim()}
        <br />
        ${nodo.salario.toLocaleString("es-CO")}
        <br />
        {nodo.totalSubordinados} colaboradores
      </div>
      {expandido[nodo.id] &&
        nodo.hijos.map((h) => renderNodoExpandido(h))}
    </div>
  );
};

const renderVisualOrganigrama = (estructura: Nodo) => {
  return (
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
          👥 Total QUICK: {estructura.totalSubordinados} colaboradores<br />
          💰 Salario total: ${estructura.salario.toLocaleString("es-CO")}
        </div>
             </div>

      {/* Cajas por línea */}
      <div style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "10px",
      }}>
        {estructura.hijos.map((lineaNodo) => {
          return (
            <div key={lineaNodo.id} style={{ minWidth: 220 }}>
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
                      {iconoPorCargo(cargoNodo.nombre)} {cargoNodo.nombre} – ${cargoNodo.salario.toLocaleString("es-CO")}
                    </div>
                    {expandido[cargoNodo.id] && (
                      <div style={{ marginLeft: 10, marginTop: 4 }}>
                        {cargoNodo.hijos.map((hijo) => renderNodoExpandido(hijo))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

  return estructura ? renderVisualOrganigrama(estructura) : <div>Cargando datos...</div>;
}





   