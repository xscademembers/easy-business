import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Contact from '@/lib/models/Contact';

export async function GET() {
  try {
    await connectDB();
    const contacts = await Contact.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ contacts });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();

    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    const contact = await Contact.create(body);
    return NextResponse.json(contact, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to submit message' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB();
    const { id } = await request.json();
    await Contact.findByIdAndUpdate(id, { read: true });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}
