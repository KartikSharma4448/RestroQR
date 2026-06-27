package com.restroqr.owner.di

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.restroqr.owner.BuildConfig
import com.restroqr.owner.data.api.RestroQrApi
import com.restroqr.owner.data.repository.AuthRepository
import com.restroqr.owner.data.repository.MenuRepository
import com.restroqr.owner.data.repository.RestaurantRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class AuthInterceptor

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    private const val PREFS_FILE_NAME = "restroqr_secure_prefs"
    private const val KEY_ACCESS_TOKEN = "access_token"

    @Provides
    @Singleton
    fun provideEncryptedSharedPreferences(
        @ApplicationContext context: Context
    ): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        return EncryptedSharedPreferences.create(
            context,
            PREFS_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    @Provides
    @Singleton
    @AuthInterceptor
    fun provideAuthInterceptor(
        sharedPreferences: SharedPreferences
    ): Interceptor {
        return Interceptor { chain ->
            val token = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
            val request = chain.request().newBuilder().apply {
                if (!token.isNullOrBlank()) {
                    addHeader("Authorization", "Bearer $token")
                }
                addHeader("Content-Type", "application/json")
                addHeader("Accept", "application/json")
            }.build()
            chain.proceed(request)
        }
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        @AuthInterceptor authInterceptor: Interceptor
    ): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideRestroQrApi(retrofit: Retrofit): RestroQrApi {
        return retrofit.create(RestroQrApi::class.java)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        api: RestroQrApi,
        sharedPreferences: SharedPreferences
    ): AuthRepository {
        return AuthRepository(api, sharedPreferences)
    }

    @Provides
    @Singleton
    fun provideRestaurantRepository(api: RestroQrApi): RestaurantRepository {
        return RestaurantRepository(api)
    }

    @Provides
    @Singleton
    fun provideMenuRepository(api: RestroQrApi): MenuRepository {
        return MenuRepository(api)
    }
}
