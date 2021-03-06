import {IPublicUser, IRegisterEmit, IUser} from "../models/user";
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import {ERole} from "../models/role";
import Service from "../models/service";
import {SECRET_TOKEN} from "../constants/config.const";

class UserService extends Service {

    public constructor() {
        super('User', {
            login: String,
            password: String,
            role: Number,
            name: String
        });
    }

    public getGeneratedToken(data: IPublicUser): string {
        return jwt.sign({login: data.login, name: data.name, role: data.role}, SECRET_TOKEN);
    }

    private async checkUserByLoginAndName(login: string, name: string): Promise<void> {
        const savedUser: IUser | null = (await this.collection.findOne({$or: [{login}, {name}]}));
        if (!savedUser) {
            return;
        }
        if (savedUser.login === login) {
            throw Error('Логин занят');
        }
        if (savedUser.name === name) {
            throw Error('Имя занято');
        }
    }

    public async getFullUserDataByLogin(login: string): Promise<null | IUser> {
        return (await this.collection.findOne({login}));
    }

    public async getPublicUserDataByToken(token: string): Promise<IPublicUser> {
        const {login, role, name} = await jwt.verify(token, SECRET_TOKEN) as IPublicUser;
        return {login, role, name}
    }

    public async getPublicUserDataByLogin(login: string): Promise<IPublicUser> {
        const user = await this.getFullUserDataByLogin(login);
        if (!user) {
            throw Error('Пользователь не найден');
        }
        return {login: user.login, role: user.role, name: user.name};
    }

    public async login(login: string, password: string): Promise<string> {
        const userData = await this.getFullUserDataByLogin(login);
        if (!userData) {
            throw Error('Пользователь не найден');
        }
        if (!await argon2.verify(userData.password, password)) {
            throw Error('Неправильный пароль');
        }
        const token = this.getGeneratedToken({login: userData.login, name: userData.name, role: userData.role});
        if (!token) {
            throw Error('Ошибка на сервере');
        }
        return token;
    }

    public async register(userData: IRegisterEmit): Promise<string> {
        try {
            await this.checkUserByLoginAndName(userData.login, userData.name);
            const createdUserData = new this.collection({
                ...userData,
                role: ERole.User,
                password: await argon2.hash(userData.password)
            } as IUser);
            await createdUserData.save();
            return await this.login(createdUserData.login, userData.password);
        } catch (e: any) {
            throw Error(e.message);
        }
    }

    public async getFullUserList(): Promise<IPublicUser[]> {
        return (await this.collection.find())?.map(({login, role, name}) => ({ login, role, name }));
    }
}

export default UserService;
