'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartDataItem {
  name: string; // Nombre de la opción
  count: number; // Cantidad de respuestas para esa opción
}

interface SingleChoiceChartProps {
  data: ChartDataItem[];
}

const SingleChoiceChart: React.FC<SingleChoiceChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No hay datos disponibles para mostrar el gráfico.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" fill="#8884d8" name="Respuestas" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SingleChoiceChart; 