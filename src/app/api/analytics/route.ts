import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/lib/models/Order';
import Product from '@/lib/models/Product';
import Customer from '@/lib/models/Customer';

export async function GET() {
  try {
    await connectDB();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProducts,
      totalCustomers,
      allOrders,
      dailyOrders,
      weeklyOrders,
      monthlyOrders,
    ] = await Promise.all([
      Product.countDocuments(),
      Customer.countDocuments(),
      Order.find().lean(),
      Order.find({ createdAt: { $gte: todayStart } }).lean(),
      Order.find({ createdAt: { $gte: weekStart } }).lean(),
      Order.find({ createdAt: { $gte: monthStart } }).lean(),
    ]);

    const calcRevenue = (orders: Array<{ totalAmount: number }>) =>
      orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const calcItemsSold = (orders: Array<{ items: Array<{ quantity: number }> }>) =>
      orders.reduce(
        (sum, o) => sum + o.items.reduce((s, i) => s + (i.quantity || 0), 0),
        0
      );

    const orderCount = allOrders.length;
    const itemsSoldAll = calcItemsSold(allOrders);
    const avgItemsPerOrder =
      orderCount > 0 ? itemsSoldAll / orderCount : 0;
    const avgOrderValue =
      orderCount > 0
        ? allOrders.reduce((s, o) => s + (o.totalAmount || 0), 0) / orderCount
        : 0;

    return NextResponse.json({
      totalProducts,
      totalCustomers,
      totalOrders: orderCount,
      totalRevenue: calcRevenue(allOrders),
      avgItemsPerOrder,
      avgOrderValue,
      daily: {
        orders: dailyOrders.length,
        revenue: calcRevenue(dailyOrders),
        itemsSold: calcItemsSold(dailyOrders),
      },
      weekly: {
        orders: weeklyOrders.length,
        revenue: calcRevenue(weeklyOrders),
        itemsSold: calcItemsSold(weeklyOrders),
      },
      monthly: {
        orders: monthlyOrders.length,
        revenue: calcRevenue(monthlyOrders),
        itemsSold: calcItemsSold(monthlyOrders),
      },
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
