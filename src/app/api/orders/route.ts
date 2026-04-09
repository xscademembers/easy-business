import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/lib/models/Order';
import Customer from '@/lib/models/Customer';

export async function GET() {
  try {
    await connectDB();
    const orders = await Order.find()
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const { customer: customerData, items, customerMessage } = await request.json();

    const name = typeof customerData?.name === 'string' ? customerData.name.trim() : '';
    const phone = typeof customerData?.phone === 'string' ? customerData.phone.trim() : '';
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone number are required' },
        { status: 400 }
      );
    }
    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const email =
      typeof customerData?.email === 'string' ? customerData.email.trim() : '';

    let customer = await Customer.findOne({ phone });
    if (!customer && email) {
      customer = await Customer.findOne({ email });
    }
    if (!customer) {
      customer = await Customer.create({
        name,
        phone,
        email,
      });
    } else {
      customer.name = name;
      if (email) customer.email = email;
      await customer.save();
    }

    const message =
      typeof customerMessage === 'string'
        ? customerMessage.trim().slice(0, 2000)
        : '';

    const totalAmount = items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    );

    const order = await Order.create({
      customer: customer._id,
      items,
      totalAmount,
      paymentType: 'offline',
      paymentStatus: 'pending',
      customerMessage: message,
    });

    customer.orders.push(order._id);
    await customer.save();

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
