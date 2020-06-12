import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const productsSelected = await this.productsRepository.findAllById(
      products,
    );

    if (products.length === 0 || productsSelected.length !== products.length) {
      throw new AppError('Products invalid.');
    }

    const hasStockSufficient = products.every(product => {
      const productSelected: Product | undefined = productsSelected.find(
        el => el.id === product.id,
      );

      if (!productSelected) {
        throw new AppError('Product not found.');
      }

      return productSelected.quantity > product.quantity;
    });

    if (!hasStockSufficient) {
      throw new AppError('Products with stock insufficient.');
    }

    const orderProducts = products.map(product => {
      const productSelected: Product | undefined = productsSelected.find(
        el => el.id === product.id,
      );

      if (!productSelected) {
        throw new AppError('Product not found.');
      }

      return {
        product_id: productSelected.id,
        price: productSelected.price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const productsUpdate = products.map(product => {
      const productFind: Product | undefined = productsSelected.find(
        el => el.id === product.id,
      );

      if (!productFind) {
        throw new AppError('Product not found.');
      }

      return {
        id: productFind.id,
        quantity: productFind.quantity - product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(productsUpdate);

    return order;
  }
}

export default CreateOrderService;
